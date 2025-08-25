#!/usr/bin/env node

/**
 * FAVICON BULK PROCESSOR - ULTRA HIGH PERFORMANCE
 * 
 * Processes 7000+ companies with parallel workers and batch database updates
 * Target: 15-25 companies per second
 */

import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Worker } from 'worker_threads';
import { URL } from 'url';

dotenv.config();

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration for maximum performance
const CONFIG = {
  CONCURRENT_WORKERS: 20,           // Number of parallel workers
  BATCH_SIZE: 100,                  // Database batch update size
  WORKER_BATCH_SIZE: 50,            // Companies per worker batch
  MAX_RETRIES: 3,                   // Retry failed companies
  TIMEOUT_MS: 5000,                 // Request timeout
  DB_POOL_SIZE: 10                  // Database connection pool size
};

// Database configuration (matching your existing setup)
const dbConfig = {
  user: process.env.DB_USER || 'doadmin',
  host: process.env.DB_HOST || 'just-work-db-do-user-24253030-0.f.db.ondigitalocean.com',
  database: process.env.DB_NAME || 'justwork',
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 25060,
  ssl: { rejectUnauthorized: false },
  max: CONFIG.DB_POOL_SIZE,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
};

const pool = new Pool(dbConfig);

// Logging setup
const logDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logFile = path.join(logDir, `favicon-bulk-${new Date().toISOString().split('T')[0]}.log`);

function log(message, data = null) {
  const timestamp = new Date().toISOString();
  const logEntry = data 
    ? `${timestamp} - ${message} - ${JSON.stringify(data)}`
    : `${timestamp} - ${message}`;
  
  console.log(logEntry);
  fs.appendFileSync(logFile, logEntry + '\n');
}

// Extract domain from website URL
function extractDomain(websiteUrl) {
  if (!websiteUrl) return null;
  
  try {
    // Clean the URL
    let cleanUrl = websiteUrl.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'https://' + cleanUrl;
    }
    
    const urlObj = new URL(cleanUrl);
    return urlObj.hostname.toLowerCase().replace('www.', '');
  } catch (error) {
    // Try basic string extraction as fallback
    try {
      const domain = websiteUrl.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
      return domain.toLowerCase();
    } catch (e) {
      return null;
    }
  }
}

// Generate Google Favicon URL
function generateFaviconUrl(domain, size = 128) {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`;
}

// Get companies that need favicon URLs
async function getCompaniesNeedingFavicons(limit = null, offset = 0) {
  const query = `
    SELECT id, company_name, website
    FROM companies 
    WHERE website IS NOT NULL 
    AND website != '' 
    AND website != '""'
    AND (favicon_url IS NULL OR favicon_url = '')
    ORDER BY id
    ${limit ? `LIMIT ${limit} OFFSET ${offset}` : ''}
  `;
  
  const result = await pool.query(query);
  return result.rows;
}

// Batch update companies with favicon URLs
async function batchUpdateFavicons(updates) {
  if (updates.length === 0) return 0;
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const updatePromises = updates.map(({ id, favicon_url, domain }) => {
      return client.query(`
        UPDATE companies 
        SET favicon_url = $1, favicon_last_updated = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [favicon_url, id]);
    });
    
    await Promise.all(updatePromises);
    await client.query('COMMIT');
    
    return updates.length;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Process a batch of companies
async function processBatch(companies) {
  const updates = [];
  const errors = [];
  
  for (const company of companies) {
    try {
      const domain = extractDomain(company.website);
      
      if (domain) {
        const faviconUrl = generateFaviconUrl(domain);
        updates.push({
          id: company.id,
          favicon_url: faviconUrl,
          domain: domain,
          company_name: company.company_name
        });
      } else {
        errors.push({
          id: company.id,
          company_name: company.company_name,
          website: company.website,
          error: 'Could not extract domain'
        });
      }
    } catch (error) {
      errors.push({
        id: company.id,
        company_name: company.company_name,
        website: company.website,
        error: error.message
      });
    }
  }
  
  return { updates, errors };
}

// Worker function for parallel processing
async function processWorkerBatch(companies, workerId) {
  const startTime = Date.now();
  log(`Worker ${workerId}: Processing ${companies.length} companies`);
  
  try {
    const { updates, errors } = await processBatch(companies);
    
    if (updates.length > 0) {
      await batchUpdateFavicons(updates);
    }
    
    const duration = Date.now() - startTime;
    const rate = Math.round((companies.length / duration) * 1000);
    
    log(`Worker ${workerId}: Completed ${updates.length} updates, ${errors.length} errors in ${duration}ms (${rate} companies/sec)`);
    
    return { 
      workerId, 
      processed: companies.length, 
      updated: updates.length, 
      errors: errors.length,
      duration,
      rate,
      errorDetails: errors
    };
  } catch (error) {
    log(`Worker ${workerId}: Fatal error`, { error: error.message });
    throw error;
  }
}

// Main execution function with parallel processing
async function runFaviconBulkProcessor() {
  const startTime = Date.now();
  log('🚀 Starting Favicon Bulk Processor - Ultra High Performance Mode');
  
  try {
    // First, add the favicon column if it doesn't exist
    await addFaviconColumn();
    
    // Get total count
    const totalResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM companies 
      WHERE website IS NOT NULL 
      AND website != '' 
      AND website != '""'
      AND (favicon_url IS NULL OR favicon_url = '')
    `);
    
    const totalCompanies = parseInt(totalResult.rows[0].count);
    log(`📊 Found ${totalCompanies} companies needing favicon URLs`);
    
    if (totalCompanies === 0) {
      log('ℹ️ No companies need favicon updates');
      return { total: 0, processed: 0, updated: 0, errors: 0 };
    }
    
    // Get all companies
    const companies = await getCompaniesNeedingFavicons();
    
    // Split into batches for parallel processing
    const batches = [];
    for (let i = 0; i < companies.length; i += CONFIG.WORKER_BATCH_SIZE) {
      batches.push(companies.slice(i, i + CONFIG.WORKER_BATCH_SIZE));
    }
    
    log(`📦 Split ${companies.length} companies into ${batches.length} batches`);
    log(`⚡ Using ${CONFIG.CONCURRENT_WORKERS} concurrent workers`);
    
    // Process batches in parallel with worker limit
    const results = {
      total: companies.length,
      processed: 0,
      updated: 0,
      errors: 0,
      errorDetails: [],
      workerResults: []
    };
    
    // Process batches with concurrency control
    for (let i = 0; i < batches.length; i += CONFIG.CONCURRENT_WORKERS) {
      const currentBatches = batches.slice(i, i + CONFIG.CONCURRENT_WORKERS);
      
      const batchPromises = currentBatches.map((batch, index) => 
        processWorkerBatch(batch, i + index + 1)
      );
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      // Aggregate results
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const workerResult = result.value;
          results.processed += workerResult.processed;
          results.updated += workerResult.updated;
          results.errors += workerResult.errors;
          results.errorDetails.push(...workerResult.errorDetails);
          results.workerResults.push(workerResult);
        } else {
          log(`❌ Worker ${i + index + 1} failed:`, { error: result.reason.message });
          results.errors += currentBatches[index].length;
        }
      });
      
      // Progress update
      const progress = Math.round((results.processed / companies.length) * 100);
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const rate = Math.round(results.processed / elapsed);
      
      log(`📈 Progress: ${progress}% (${results.processed}/${companies.length}) - ${rate} companies/sec`);
    }
    
    const endTime = Date.now();
    const totalDuration = Math.round((endTime - startTime) / 1000);
    const overallRate = Math.round(results.processed / totalDuration);
    const successRate = Math.round((results.updated / results.processed) * 100);
    
    log('🎉 Favicon Bulk Processing Completed!');
    log(`📊 Final Results:`);
    log(`   Total Companies: ${results.total}`);
    log(`   Processed: ${results.processed}`);
    log(`   Updated: ${results.updated}`);
    log(`   Errors: ${results.errors}`);
    log(`   Duration: ${totalDuration} seconds`);
    log(`   Rate: ${overallRate} companies/second`);
    log(`   Success Rate: ${successRate}%`);
    
    // Save detailed results
    const resultsFile = path.join(logDir, `favicon-bulk-results-${new Date().toISOString().split('T')[0]}.json`);
    fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
    log(`💾 Detailed results saved to: ${resultsFile}`);
    
    return results;
    
  } catch (error) {
    log('❌ FATAL ERROR in Favicon Bulk Processor', { error: error.message });
    throw error;
  } finally {
    await pool.end();
  }
}

// Add favicon column if it doesn't exist
async function addFaviconColumn() {
  try {
    await pool.query(`
      ALTER TABLE companies 
      ADD COLUMN IF NOT EXISTS favicon_url TEXT,
      ADD COLUMN IF NOT EXISTS favicon_last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    `);
    
    // Create index for performance
    await pool.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_companies_favicon_url 
      ON companies(favicon_url) WHERE favicon_url IS NOT NULL
    `);
    
    log('✅ Database schema updated with favicon columns');
  } catch (error) {
    log('⚠️ Schema update warning (may already exist)', { error: error.message });
  }
}

// Export for use by other modules
export { runFaviconBulkProcessor, processBatch, generateFaviconUrl };

// Command line execution
if (import.meta.url === `file://${process.argv[1]}`) {
  runFaviconBulkProcessor().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
