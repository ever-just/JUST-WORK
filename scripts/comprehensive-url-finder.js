#!/usr/bin/env node

/**
 * COMPREHENSIVE URL FINDER
 * 
 * Multi-tier approach for finding company websites:
 * 1. Google Places API (primary)
 * 2. Domain generation + validation (secondary)
 * 3. Social media presence detection (tertiary)
 * 4. Mark as "no website" with confidence (final)
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
const DELAY_BETWEEN_REQUESTS = 2000;
const DELAY_BETWEEN_BATCHES = 5000;

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

const logFile = path.join(logDir, `comprehensive-url-finder-${new Date().toISOString().split('T')[0]}.log`);

function log(message, data = null) {
  const timestamp = new Date().toISOString();
  const logEntry = data 
    ? `${timestamp} - ${message} - ${JSON.stringify(data)}`
    : `${timestamp} - ${message}`;
  
  console.log(logEntry);
  fs.appendFileSync(logFile, logEntry + '\n');
}

// Helper function for API requests
function makeApiRequest(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

// TIER 1: Google Places API
async function findWithGooglePlaces(companyName, city, state) {
  const query = `${companyName} ${city} ${state}`;
  const encodedQuery = encodeURIComponent(query);
  
  try {
    // Step 1: Find Place
    const findUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodedQuery}&inputtype=textquery&fields=name,place_id&key=${GOOGLE_MAPS_API_KEY}`;
    const findResult = await makeApiRequest(findUrl);
    
    if (findResult.status !== 'OK' || !findResult.candidates || findResult.candidates.length === 0) {
      return { success: false, tier: 1, reason: `Google Places: ${findResult.status}` };
    }
    
    // Step 2: Get Details
    const place = findResult.candidates[0];
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,website,formatted_address&key=${GOOGLE_MAPS_API_KEY}`;
    const detailsResult = await makeApiRequest(detailsUrl);
    
    if (detailsResult.status === 'OK' && detailsResult.result && detailsResult.result.website) {
      return {
        success: true,
        tier: 1,
        method: 'google_places',
        url: detailsResult.result.website,
        confidence: 0.9,
        place_name: detailsResult.result.name,
        address: detailsResult.result.formatted_address
      };
    }
    
    return { success: false, tier: 1, reason: 'Google Places: No website found' };
    
  } catch (error) {
    return { success: false, tier: 1, reason: `Google Places error: ${error.message}` };
  }
}

// TIER 2: Domain Generation + Validation
function generatePotentialDomains(companyName) {
  const cleanName = companyName.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\b(inc|llc|corp|company|ltd|co)\b/g, '')
    .trim();
  
  const words = cleanName.split(/\s+/).filter(word => word.length > 0);
  const domains = [];
  
  if (words.length === 0) return domains;
  
  if (words.length === 1) {
    domains.push(`${words[0]}.com`, `${words[0]}.net`);
  } else {
    const concatenated = words.join('');
    const hyphenated = words.join('-');
    
    domains.push(
      `${concatenated}.com`,
      `${concatenated}.net`,
      `${hyphenated}.com`,
      `${hyphenated}.net`,
      `${words[0]}.com`
    );
    
    if (words.length >= 2) {
      domains.push(`${words[0]}${words[1]}.com`);
    }
  }
  
  return [...new Set(domains)];
}

async function checkUrlAccessibility(url) {
  return new Promise((resolve) => {
    try {
      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname,
        method: 'HEAD',
        timeout: 8000,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; URL-Checker/1.0)' }
      };
      
      const protocol = urlObj.protocol === 'https:' ? https : require('http');
      const req = protocol.request(options, (res) => {
        resolve({
          accessible: res.statusCode >= 200 && res.statusCode < 400,
          statusCode: res.statusCode
        });
      });
      
      req.on('error', () => resolve({ accessible: false }));
      req.on('timeout', () => { req.destroy(); resolve({ accessible: false }); });
      req.setTimeout(8000);
      req.end();
    } catch (error) {
      resolve({ accessible: false });
    }
  });
}

async function findWithDomainGeneration(companyName) {
  const potentialDomains = generatePotentialDomains(companyName);
  
  if (potentialDomains.length === 0) {
    return { success: false, tier: 2, reason: 'No domains could be generated' };
  }
  
  log(`🔗 Testing ${potentialDomains.length} potential domains for ${companyName}`);
  
  for (const domain of potentialDomains) {
    const url = `https://www.${domain}`;
    const accessibility = await checkUrlAccessibility(url);
    
    if (accessibility.accessible) {
      // Check domain relevance
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
      
      const confidence = nameMatch ? 0.7 : 0.5;
      
      if (confidence >= 0.5) {
        return {
          success: true,
          tier: 2,
          method: 'domain_generation',
          url: url,
          confidence: confidence,
          nameMatch: nameMatch,
          statusCode: accessibility.statusCode
        };
      }
    }
    
    // Small delay between checks
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return { success: false, tier: 2, reason: `No accessible domains found (tested ${potentialDomains.length})` };
}

// TIER 3: Social Media Presence Detection
async function findSocialMediaPresence(companyName, city, state) {
  const searchTerms = [
    `"${companyName}" ${city} ${state} facebook`,
    `"${companyName}" ${city} ${state} linkedin`,
    `"${companyName}" ${city} ${state} instagram`
  ];
  
  // For now, we'll mark this as a placeholder
  // In a real implementation, you might use a web search API or scraping
  
  return { 
    success: false, 
    tier: 3, 
    reason: 'Social media detection not implemented',
    note: 'Could implement with web search API or manual verification'
  };
}

// TIER 4: Mark as "No Website" with confidence
function markAsNoWebsite(companyName, attempts) {
  return {
    success: true,
    tier: 4,
    method: 'no_website_found',
    url: null,
    confidence: 0.8,
    reason: 'Comprehensive search completed - no website found',
    attempts_made: attempts
  };
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

// Update company with result
async function updateCompanyResult(companyId, result) {
  let query, params;
  
  if (result.url) {
    // Found a website
    query = `
      UPDATE companies 
      SET website = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND (website IS NULL OR website = '' OR website = '""')
    `;
    params = [result.url, companyId];
  } else {
    // No website found - could add a "no_website" flag if desired
    // For now, we'll just log it but not update the database
    log(`📝 No website found for company ${companyId} after comprehensive search`);
    return true;
  }
  
  const dbResult = await pool.query(query, params);
  
  if (dbResult.rowCount > 0) {
    log(`✅ Updated company ${companyId} with result`, result);
    return true;
  } else {
    log(`⚠️ No update made for company ${companyId}`);
    return false;
  }
}

// Process a single company through all tiers
async function processCompanyComprehensive(company) {
  log(`🏢 Processing: ${company.company_name} (${company.city}, ${company.state})`);
  
  const attempts = [];
  
  try {
    // TIER 1: Google Places API
    log(`🔍 TIER 1: Google Places API search`);
    const tier1Result = await findWithGooglePlaces(company.company_name, company.city, company.state);
    attempts.push(tier1Result);
    
    if (tier1Result.success) {
      const updated = await updateCompanyResult(company.id, tier1Result);
      if (updated) {
        return {
          success: true,
          company: company.company_name,
          result: tier1Result,
          attempts: attempts
        };
      }
    }
    
    // TIER 2: Domain Generation + Validation
    log(`🔍 TIER 2: Domain generation and validation`);
    const tier2Result = await findWithDomainGeneration(company.company_name);
    attempts.push(tier2Result);
    
    if (tier2Result.success && tier2Result.confidence >= 0.6) {
      const updated = await updateCompanyResult(company.id, tier2Result);
      if (updated) {
        return {
          success: true,
          company: company.company_name,
          result: tier2Result,
          attempts: attempts
        };
      }
    }
    
    // TIER 3: Social Media Presence (placeholder)
    log(`🔍 TIER 3: Social media presence check`);
    const tier3Result = await findSocialMediaPresence(company.company_name, company.city, company.state);
    attempts.push(tier3Result);
    
    if (tier3Result.success) {
      const updated = await updateCompanyResult(company.id, tier3Result);
      if (updated) {
        return {
          success: true,
          company: company.company_name,
          result: tier3Result,
          attempts: attempts
        };
      }
    }
    
    // TIER 4: Mark as "No Website"
    log(`📝 TIER 4: Marking as no website found`);
    const tier4Result = markAsNoWebsite(company.company_name, attempts);
    
    return {
      success: false,
      company: company.company_name,
      result: tier4Result,
      attempts: attempts,
      final_status: 'no_website_found'
    };
    
  } catch (error) {
    log(`❌ Error in comprehensive processing for ${company.company_name}`, { error: error.message });
    return {
      success: false,
      company: company.company_name,
      result: { error: error.message },
      attempts: attempts
    };
  }
}

// Main execution function
async function runComprehensiveUrlFinder(testMode = true) {
  const startTime = new Date();
  log(`🚀 Starting Comprehensive URL Finder - Test Mode: ${testMode}`);
  
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error('GOOGLE_MAPS_API_KEY environment variable is required');
  }
  
  try {
    const limit = testMode ? 5 : null;
    const companies = await getCompaniesMissingUrls(limit);
    
    if (companies.length === 0) {
      log('ℹ️ No companies found missing URLs');
      return { total: 0, found: 0, failed: 0, no_website: 0 };
    }
    
    const results = {
      total: companies.length,
      processed: 0,
      found: 0,
      failed: 0,
      no_website: 0,
      urls: [],
      no_website_companies: [],
      errors: []
    };
    
    log(`📋 Processing ${companies.length} companies with comprehensive approach`);
    
    for (const company of companies) {
      const result = await processCompanyComprehensive(company);
      results.processed++;
      
      if (result.success) {
        results.found++;
        results.urls.push({
          company_id: company.id,
          company_name: result.company,
          url: result.result.url,
          confidence: result.result.confidence,
          method: result.result.method,
          tier: result.result.tier
        });
        log(`✅ SUCCESS: ${result.company} -> ${result.result.url} (Tier ${result.result.tier})`);
      } else if (result.final_status === 'no_website_found') {
        results.no_website++;
        results.no_website_companies.push({
          company_name: result.company,
          attempts: result.attempts.length,
          reason: 'Comprehensive search completed - no website exists'
        });
        log(`📝 NO WEBSITE: ${result.company} (${result.attempts.length} attempts made)`);
      } else {
        results.failed++;
        results.errors.push(result);
        log(`❌ FAILED: ${result.company}`);
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
    }
    
    const endTime = new Date();
    const duration = Math.round((endTime - startTime) / 1000);
    const foundRate = Math.round((results.found / results.total) * 100);
    const noWebsiteRate = Math.round((results.no_website / results.total) * 100);
    
    log(`🎉 Comprehensive URL Finder completed in ${duration} seconds`);
    log(`📊 Results: ${results.found} URLs found (${foundRate}%), ${results.no_website} no website (${noWebsiteRate}%)`);
    
    // Save detailed results
    const resultsFile = path.join(logDir, `comprehensive-results-${new Date().toISOString().split('T')[0]}.json`);
    fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
    log(`💾 Detailed results saved to: ${resultsFile}`);
    
    return results;
    
  } catch (error) {
    log(`❌ FATAL ERROR in Comprehensive URL finder`, { error: error.message });
    throw error;
  } finally {
    await pool.end();
  }
}

// Export functions
export { runComprehensiveUrlFinder, processCompanyComprehensive };

// Command line execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const testMode = process.argv.includes('--test') || process.argv.includes('-t');
  const fullMode = process.argv.includes('--full') || process.argv.includes('-f');
  
  runComprehensiveUrlFinder(!fullMode).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
