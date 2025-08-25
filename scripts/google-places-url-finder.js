#!/usr/bin/env node

/**
 * GOOGLE PLACES URL FINDER
 * 
 * This system uses the Google Places API to find legitimate company websites.
 * It processes companies missing URLs and validates all results before database updates.
 */

import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import { URL } from 'url';

dotenv.config();

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const BATCH_SIZE = 10;
const DELAY_BETWEEN_REQUESTS = 2000; // 2 seconds
const DELAY_BETWEEN_BATCHES = 5000; // 5 seconds

// Database configuration
const dbConfig = {
  user: process.env.DB_USER || 'doadmin',
  host: process.env.DB_HOST || 'just-work-db-do-user-24253030-0.f.db.ondigitalocean.com',
  database: process.env.DB_NAME || 'justwork',
  password: process.env.DB_PASSWORD || 'REDACTED_PASSWORD',
  port: process.env.DB_PORT || 25060,
  ssl: { rejectUnauthorized: false }
};

const pool = new Pool(dbConfig);

// Logging setup
const logDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logFile = path.join(logDir, `google-places-finder-${new Date().toISOString().split('T')[0]}.log`);

function log(message, data = null) {
  const timestamp = new Date().toISOString();
  const logEntry = data 
    ? `${timestamp} - ${message} - ${JSON.stringify(data)}`
    : `${timestamp} - ${message}`;
  
  console.log(logEntry);
  fs.appendFileSync(logFile, logEntry + '\n');
}

// Google Places API integration - Two-step process
async function findPlaceWithGooglePlaces(companyName, city, state) {
  const query = `${companyName} ${city} ${state}`;
  const encodedQuery = encodeURIComponent(query);
  
  // Step 1: Find Place to get place_id
  const findUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodedQuery}&inputtype=textquery&fields=name,place_id&key=${GOOGLE_MAPS_API_KEY}`;
  
  log(`🔍 Google Places API search: ${query}`);
  
  try {
    // Find the place first
    const findResult = await makeApiRequest(findUrl);
    
    if (findResult.status !== 'OK' || !findResult.candidates || findResult.candidates.length === 0) {
      log(`❌ No results found for: ${query}`, { status: findResult.status });
      return { success: false, reason: `No results: ${findResult.status}` };
    }
    
    const place = findResult.candidates[0];
    log(`🔍 Found place: ${place.name}, getting details...`);
    
    // Step 2: Get Place Details to get website
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,website,formatted_address,url&key=${GOOGLE_MAPS_API_KEY}`;
    
    const detailsResult = await makeApiRequest(detailsUrl);
    
    if (detailsResult.status === 'OK' && detailsResult.result) {
      const details = detailsResult.result;
      log(`✅ Found place details: ${details.name}`, { 
        website: details.website, 
        address: details.formatted_address 
      });
      
      return {
        success: true,
        name: details.name,
        website: details.website || null,
        address: details.formatted_address,
        place_id: place.place_id,
        google_url: details.url
      };
    } else {
      log(`❌ Could not get details for place: ${place.name}`, { status: detailsResult.status });
      return { success: false, reason: `Details failed: ${detailsResult.status}` };
    }
    
  } catch (error) {
    log(`❌ Google Places API error for: ${query}`, { error: error.message });
    return { success: false, reason: error.message };
  }
}

// Helper function to make API requests
function makeApiRequest(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve(response);
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

// URL validation
function isValidBusinessUrl(url, companyName) {
  if (!url) return { isValid: false, reason: 'No URL provided' };
  
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.toLowerCase();
    
    // Filter out social media and directories
    const excludePatterns = [
      'facebook.com', 'linkedin.com', 'twitter.com', 'instagram.com', 'youtube.com',
      'yellowpages.com', 'yelp.com', 'google.com', 'mapquest.com', 'whitepages.com',
      'bbb.org', 'manta.com', 'bizapedia.com', 'corporationwiki.com'
    ];
    
    for (const pattern of excludePatterns) {
      if (domain.includes(pattern)) {
        return { isValid: false, reason: `Excluded domain: ${pattern}` };
      }
    }
    
    // Check if domain might be related to company name
    const companyWords = companyName.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\b(inc|llc|corp|company|ltd|co)\b/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2);
    
    let nameMatch = false;
    for (const word of companyWords) {
      if (domain.includes(word)) {
        nameMatch = true;
        break;
      }
    }
    
    const confidence = nameMatch ? 0.9 : 0.7;
    
    return { 
      isValid: true, 
      confidence: confidence,
      reason: nameMatch ? 'Domain matches company name' : 'Valid business domain',
      domain: domain,
      nameMatch: nameMatch
    };
    
  } catch (error) {
    return { isValid: false, reason: `Invalid URL format: ${error.message}` };
  }
}

// Get companies missing URLs
async function getCompaniesMissingUrls(limit = null) {
  const query = `
    SELECT id, company_name, city, state, website
    FROM companies 
    WHERE website IS NULL OR website = '' OR website = '""'
    ORDER BY company_name
    ${limit ? `LIMIT ${limit}` : ''}
  `;
  
  const result = await pool.query(query);
  log(`📊 Found ${result.rows.length} companies missing URLs`);
  return result.rows;
}

// Update company with found URL
async function updateCompanyUrl(companyId, url, metadata) {
  const query = `
    UPDATE companies 
    SET website = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2 AND (website IS NULL OR website = '' OR website = '""')
  `;
  
  const result = await pool.query(query, [url, companyId]);
  
  if (result.rowCount > 0) {
    log(`✅ Updated company ${companyId} with URL: ${url}`, metadata);
    return true;
  } else {
    log(`⚠️ No update made for company ${companyId} - may already have URL`);
    return false;
  }
}

// Process a single company
async function processCompany(company) {
  log(`🏢 Processing: ${company.company_name} (${company.city}, ${company.state})`);
  
  try {
    // Search with Google Places API
    const placeResult = await findPlaceWithGooglePlaces(
      company.company_name, 
      company.city, 
      company.state
    );
    
    if (!placeResult.success) {
      return { 
        success: false, 
        company: company.company_name,
        reason: placeResult.reason 
      };
    }
    
    if (!placeResult.website) {
      log(`❌ No website found for ${company.company_name} in Google Places`);
      return { 
        success: false, 
        company: company.company_name,
        reason: 'No website in Google Places data' 
      };
    }
    
    // Validate the URL
    const validation = isValidBusinessUrl(placeResult.website, company.company_name);
    
    if (!validation.isValid) {
      log(`❌ Invalid URL for ${company.company_name}: ${placeResult.website}`, { reason: validation.reason });
      return { 
        success: false, 
        company: company.company_name,
        reason: validation.reason,
        url: placeResult.website
      };
    }
    
    // URL is valid, update database
    const updated = await updateCompanyUrl(company.id, placeResult.website, {
      confidence: validation.confidence,
      source: 'google_places',
      place_name: placeResult.name,
      place_address: placeResult.address
    });
    
    if (updated) {
      return {
        success: true,
        company: company.company_name,
        url: placeResult.website,
        confidence: validation.confidence,
        place_name: placeResult.name
      };
    } else {
      return {
        success: false,
        company: company.company_name,
        reason: 'Database update failed'
      };
    }
    
  } catch (error) {
    log(`❌ Error processing ${company.company_name}`, { error: error.message });
    return {
      success: false,
      company: company.company_name,
      reason: error.message
    };
  }
}

// Main execution function
async function runGooglePlacesUrlFinder(testMode = true) {
  const startTime = new Date();
  log(`🚀 Starting Google Places URL Finder - Test Mode: ${testMode}`);
  
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error('GOOGLE_MAPS_API_KEY environment variable is required');
  }
  
  try {
    // Get companies to process
    const limit = testMode ? 10 : null;
    const companies = await getCompaniesMissingUrls(limit);
    
    if (companies.length === 0) {
      log('ℹ️ No companies found missing URLs');
      return { total: 0, found: 0, failed: 0 };
    }
    
    const results = {
      total: companies.length,
      processed: 0,
      found: 0,
      failed: 0,
      urls: [],
      errors: []
    };
    
    log(`📋 Processing ${companies.length} companies in batches of ${BATCH_SIZE}`);
    
    // Process companies in batches
    for (let i = 0; i < companies.length; i += BATCH_SIZE) {
      const batch = companies.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(companies.length / BATCH_SIZE);
      
      log(`📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} companies)`);
      
      for (const company of batch) {
        const result = await processCompany(company);
        results.processed++;
        
        if (result.success) {
          results.found++;
          results.urls.push({
            company_id: company.id,
            company_name: result.company,
            url: result.url,
            confidence: result.confidence,
            place_name: result.place_name
          });
          log(`✅ SUCCESS: ${result.company} -> ${result.url}`);
        } else {
          results.failed++;
          results.errors.push(result);
          log(`❌ FAILED: ${result.company} - ${result.reason}`);
        }
        
        // Rate limiting between requests
        if (results.processed < companies.length) {
          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
        }
      }
      
      // Batch delay
      if (i + BATCH_SIZE < companies.length) {
        log(`⏳ Batch ${batchNum} completed. Waiting ${DELAY_BETWEEN_BATCHES/1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
      }
    }
    
    const endTime = new Date();
    const duration = Math.round((endTime - startTime) / 1000);
    const successRate = Math.round((results.found / results.total) * 100);
    
    log(`🎉 Google Places URL Finder completed in ${duration} seconds`);
    log(`📊 Results: ${results.found}/${results.total} URLs found (${successRate}% success rate)`);
    
    // Save detailed results
    const resultsFile = path.join(logDir, `google-places-results-${new Date().toISOString().split('T')[0]}.json`);
    fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
    log(`💾 Detailed results saved to: ${resultsFile}`);
    
    return results;
    
  } catch (error) {
    log(`❌ FATAL ERROR in Google Places URL finder`, { error: error.message });
    throw error;
  } finally {
    await pool.end();
  }
}

// Export for use by other modules
export { runGooglePlacesUrlFinder, processCompany, findPlaceWithGooglePlaces };

// Command line execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const testMode = process.argv.includes('--test') || process.argv.includes('-t');
  const fullMode = process.argv.includes('--full') || process.argv.includes('-f');
  
  runGooglePlacesUrlFinder(!fullMode).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
