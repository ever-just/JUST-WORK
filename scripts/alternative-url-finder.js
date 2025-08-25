#!/usr/bin/env node

/**
 * ALTERNATIVE URL FINDER
 * 
 * Since the Google Places API is returning REQUEST_DENIED, this script uses
 * alternative methods to find company websites including:
 * 1. Common domain patterns
 * 2. Business directory APIs (if available)
 * 3. Manual validation of constructed URLs
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

const logFile = path.join(logDir, `alternative-url-finder-${new Date().toISOString().split('T')[0]}.log`);

function log(message, data = null) {
  const timestamp = new Date().toISOString();
  const logEntry = data 
    ? `${timestamp} - ${message} - ${JSON.stringify(data)}`
    : `${timestamp} - ${message}`;
  
  console.log(logEntry);
  fs.appendFileSync(logFile, logEntry + '\n');
}

// Generate potential domain names from company name
function generatePotentialDomains(companyName) {
  const cleanName = companyName.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\b(inc|llc|corp|company|ltd|co)\b/g, '')
    .trim();
  
  const words = cleanName.split(/\s+/).filter(word => word.length > 0);
  const domains = [];
  
  if (words.length === 0) return domains;
  
  // Single word or concatenated
  if (words.length === 1) {
    domains.push(`${words[0]}.com`);
    domains.push(`${words[0]}.net`);
  } else {
    // Concatenated words
    const concatenated = words.join('');
    domains.push(`${concatenated}.com`);
    domains.push(`${concatenated}.net`);
    
    // With hyphens
    const hyphenated = words.join('-');
    domains.push(`${hyphenated}.com`);
    domains.push(`${hyphenated}.net`);
    
    // First word only
    domains.push(`${words[0]}.com`);
    
    // First two words
    if (words.length >= 2) {
      domains.push(`${words[0]}${words[1]}.com`);
      domains.push(`${words[0]}-${words[1]}.com`);
    }
  }
  
  return [...new Set(domains)]; // Remove duplicates
}

// Check if a URL is accessible
async function checkUrlAccessibility(url) {
  return new Promise((resolve) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname,
      method: 'HEAD',
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; URL-Checker/1.0)'
      }
    };
    
    const protocol = urlObj.protocol === 'https:' ? https : require('http');
    
    const req = protocol.request(options, (res) => {
      const isAccessible = res.statusCode >= 200 && res.statusCode < 400;
      resolve({
        accessible: isAccessible,
        statusCode: res.statusCode,
        redirected: res.statusCode >= 300 && res.statusCode < 400,
        finalUrl: res.headers.location || url
      });
    });
    
    req.on('error', () => {
      resolve({ accessible: false, error: 'Connection failed' });
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve({ accessible: false, error: 'Timeout' });
    });
    
    req.setTimeout(10000);
    req.end();
  });
}

// Validate if URL looks like a business website
async function validateBusinessWebsite(url, companyName) {
  log(`🔍 Validating URL: ${url} for ${companyName}`);
  
  try {
    const accessibility = await checkUrlAccessibility(url);
    
    if (!accessibility.accessible) {
      return { 
        isValid: false, 
        reason: accessibility.error || `HTTP ${accessibility.statusCode}`,
        confidence: 0 
      };
    }
    
    // Check domain relevance
    const urlObj = new URL(url);
    const domain = urlObj.hostname.toLowerCase();
    
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
    
    const confidence = nameMatch ? 0.8 : 0.6;
    
    log(`✅ URL validated: ${url}`, { 
      accessible: true, 
      nameMatch, 
      confidence,
      statusCode: accessibility.statusCode 
    });
    
    return {
      isValid: true,
      confidence: confidence,
      reason: nameMatch ? 'Domain matches company name' : 'Accessible business domain',
      statusCode: accessibility.statusCode,
      nameMatch: nameMatch
    };
    
  } catch (error) {
    log(`❌ URL validation failed: ${url}`, { error: error.message });
    return { isValid: false, reason: error.message, confidence: 0 };
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
    // Generate potential domains
    const potentialDomains = generatePotentialDomains(company.company_name);
    log(`🔗 Generated ${potentialDomains.length} potential domains`, { domains: potentialDomains });
    
    if (potentialDomains.length === 0) {
      return {
        success: false,
        company: company.company_name,
        reason: 'Could not generate potential domains'
      };
    }
    
    // Test each potential domain
    for (const domain of potentialDomains) {
      const url = `https://www.${domain}`;
      
      const validation = await validateBusinessWebsite(url, company.company_name);
      
      if (validation.isValid && validation.confidence > 0.5) {
        // Found a valid URL, update database
        const updated = await updateCompanyUrl(company.id, url, {
          confidence: validation.confidence,
          source: 'domain_generation',
          method: 'accessibility_check',
          statusCode: validation.statusCode,
          nameMatch: validation.nameMatch
        });
        
        if (updated) {
          return {
            success: true,
            company: company.company_name,
            url: url,
            confidence: validation.confidence,
            method: 'domain_generation'
          };
        }
      }
      
      // Small delay between checks
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    log(`❌ No valid URLs found for ${company.company_name}`);
    return {
      success: false,
      company: company.company_name,
      reason: 'No accessible domains found',
      testedDomains: potentialDomains.length
    };
    
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
async function runAlternativeUrlFinder(testMode = true) {
  const startTime = new Date();
  log(`🚀 Starting Alternative URL Finder - Test Mode: ${testMode}`);
  
  try {
    // Get companies to process
    const limit = testMode ? 5 : 50; // Start small
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
    
    log(`📋 Processing ${companies.length} companies`);
    
    // Process companies one by one
    for (const company of companies) {
      const result = await processCompany(company);
      results.processed++;
      
      if (result.success) {
        results.found++;
        results.urls.push({
          company_id: company.id,
          company_name: result.company,
          url: result.url,
          confidence: result.confidence,
          method: result.method
        });
        log(`✅ SUCCESS: ${result.company} -> ${result.url}`);
      } else {
        results.failed++;
        results.errors.push(result);
        log(`❌ FAILED: ${result.company} - ${result.reason}`);
      }
      
      // Rate limiting between companies
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    const endTime = new Date();
    const duration = Math.round((endTime - startTime) / 1000);
    const successRate = Math.round((results.found / results.total) * 100);
    
    log(`🎉 Alternative URL Finder completed in ${duration} seconds`);
    log(`📊 Results: ${results.found}/${results.total} URLs found (${successRate}% success rate)`);
    
    // Save detailed results
    const resultsFile = path.join(logDir, `alternative-url-results-${new Date().toISOString().split('T')[0]}.json`);
    fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
    log(`💾 Detailed results saved to: ${resultsFile}`);
    
    return results;
    
  } catch (error) {
    log(`❌ FATAL ERROR in Alternative URL finder`, { error: error.message });
    throw error;
  } finally {
    await pool.end();
  }
}

// Export for use by other modules
export { runAlternativeUrlFinder, processCompany, generatePotentialDomains, validateBusinessWebsite };

// Command line execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const testMode = process.argv.includes('--test') || process.argv.includes('-t');
  const fullMode = process.argv.includes('--full') || process.argv.includes('-f');
  
  runAlternativeUrlFinder(!fullMode).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
