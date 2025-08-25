#!/usr/bin/env node

/**
 * FAVICON PARALLEL LAUNCHER - MAXIMUM SPEED
 * 
 * Launches multiple favicon processors simultaneously for ultra-fast processing
 * Can process 7000+ companies in 3-5 minutes using parallel script execution
 */

import { spawn } from 'child_process';
import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration for maximum parallel processing
const CONFIG = {
  PARALLEL_SCRIPTS: 4,              // Number of parallel scripts to run
  COMPANIES_PER_SCRIPT: 2000,       // Companies per script (with overlap handling)
  SCRIPT_TIMEOUT: 600000,           // 10 minutes timeout per script
  MONITORING_INTERVAL: 5000         // Progress monitoring every 5 seconds
};

// Database configuration
const dbConfig = {
  user: process.env.DB_USER || 'doadmin',
  host: process.env.DB_HOST || 'just-work-db-do-user-24253030-0.f.db.ondigitalocean.com',
  database: process.env.DB_NAME || 'justwork',
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 25060,
  ssl: { rejectUnauthorized: false }
};

const pool = new Pool(dbConfig);

// Logging setup
const logDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logFile = path.join(logDir, `favicon-parallel-${new Date().toISOString().split('T')[0]}.log`);

function log(message, data = null) {
  const timestamp = new Date().toISOString();
  const logEntry = data 
    ? `${timestamp} - ${message} - ${JSON.stringify(data)}`
    : `${timestamp} - ${message}`;
  
  console.log(logEntry);
  fs.appendFileSync(logFile, logEntry + '\n');
}

// Create individual processor script for range-based processing
async function createRangeProcessor() {
  const processorScript = `#!/usr/bin/env node

/**
 * RANGE-BASED FAVICON PROCESSOR
 * Processes a specific range of companies to avoid conflicts
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { URL } from 'url';

dotenv.config();

const { Pool } = pg;

const dbConfig = {
  user: process.env.DB_USER || 'doadmin',
  host: process.env.DB_HOST || 'just-work-db-do-user-24253030-0.f.db.ondigitalocean.com',
  database: process.env.DB_NAME || 'justwork',
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 25060,
  ssl: { rejectUnauthorized: false },
  max: 5
};

const pool = new Pool(dbConfig);

function extractDomain(websiteUrl) {
  if (!websiteUrl) return null;
  
  try {
    let cleanUrl = websiteUrl.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'https://' + cleanUrl;
    }
    
    const urlObj = new URL(cleanUrl);
    return urlObj.hostname.toLowerCase().replace('www.', '');
  } catch (error) {
    try {
      const domain = websiteUrl.replace(/^https?:\\/\\//, '').replace(/^www\\./, '').split('/')[0];
      return domain.toLowerCase();
    } catch (e) {
      return null;
    }
  }
}

function generateFaviconUrl(domain, size = 128) {
  return \`https://www.google.com/s2/favicons?domain=\${domain}&sz=\${size}\`;
}

async function processRange(startId, endId, scriptId) {
  const startTime = Date.now();
  console.log(\`Script \${scriptId}: Processing companies with ID range \${startId} to \${endId}\`);
  
  try {
    // Get companies in this range that need favicon URLs
    const result = await pool.query(\`
      SELECT id, company_name, website
      FROM companies 
      WHERE id >= $1 AND id <= $2
      AND website IS NOT NULL 
      AND website != '' 
      AND website != '""'
      AND (favicon_url IS NULL OR favicon_url = '')
      ORDER BY id
    \`, [startId, endId]);
    
    const companies = result.rows;
    console.log(\`Script \${scriptId}: Found \${companies.length} companies to process\`);
    
    if (companies.length === 0) {
      console.log(\`Script \${scriptId}: No companies to process in this range\`);
      await pool.end();
      return { processed: 0, updated: 0, errors: 0 };
    }
    
    let processed = 0;
    let updated = 0;
    let errors = 0;
    
    // Process in batches of 50
    const batchSize = 50;
    for (let i = 0; i < companies.length; i += batchSize) {
      const batch = companies.slice(i, i + batchSize);
      const updates = [];
      
      for (const company of batch) {
        try {
          const domain = extractDomain(company.website);
          
          if (domain) {
            const faviconUrl = generateFaviconUrl(domain);
            updates.push([faviconUrl, company.id]);
          } else {
            errors++;
          }
          processed++;
        } catch (error) {
          errors++;
          processed++;
        }
      }
      
      // Batch update database
      if (updates.length > 0) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          
          for (const [faviconUrl, companyId] of updates) {
            await client.query(\`
              UPDATE companies 
              SET favicon_url = $1, favicon_last_updated = CURRENT_TIMESTAMP
              WHERE id = $2
            \`, [faviconUrl, companyId]);
          }
          
          await client.query('COMMIT');
          updated += updates.length;
        } catch (error) {
          await client.query('ROLLBACK');
          errors += updates.length;
        } finally {
          client.release();
        }
      }
      
      // Progress update
      if ((i + batchSize) % 200 === 0 || i + batchSize >= companies.length) {
        const progress = Math.round(((i + batchSize) / companies.length) * 100);
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        const rate = Math.round(processed / elapsed);
        console.log(\`Script \${scriptId}: \${progress}% complete - \${rate} companies/sec\`);
      }
    }
    
    const duration = Math.round((Date.now() - startTime) / 1000);
    const rate = Math.round(processed / duration);
    
    console.log(\`Script \${scriptId}: Completed - \${updated} updated, \${errors} errors in \${duration}s (\${rate} companies/sec)\`);
    
    await pool.end();
    return { processed, updated, errors, duration, rate };
    
  } catch (error) {
    console.error(\`Script \${scriptId}: Fatal error:`, error.message);
    await pool.end();
    throw error;
  }
}

// Get command line arguments
const startId = parseInt(process.argv[2]);
const endId = parseInt(process.argv[3]);
const scriptId = process.argv[4] || 'unknown';

if (!startId || !endId) {
  console.error('Usage: node range-processor.js <startId> <endId> <scriptId>');
  process.exit(1);
}

processRange(startId, endId, scriptId).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
`;

  const processorPath = path.join(__dirname, 'favicon-range-processor.js');
  fs.writeFileSync(processorPath, processorScript);
  return processorPath;
}

// Get ID ranges for parallel processing
async function getCompanyIdRanges() {
  try {
    const result = await pool.query(`
      SELECT MIN(id) as min_id, MAX(id) as max_id, COUNT(*) as total_count
      FROM companies 
      WHERE website IS NOT NULL 
      AND website != '' 
      AND website != '""'
      AND (favicon_url IS NULL OR favicon_url = '')
    `);
    
    const { min_id, max_id, total_count } = result.rows[0];
    
    if (!min_id || !max_id || total_count === 0) {
      return [];
    }
    
    log(`📊 Company ID range: ${min_id} to ${max_id} (${total_count} companies)`);
    
    // Calculate ranges for parallel processing
    const ranges = [];
    const rangeSize = Math.ceil((max_id - min_id + 1) / CONFIG.PARALLEL_SCRIPTS);
    
    for (let i = 0; i < CONFIG.PARALLEL_SCRIPTS; i++) {
      const startId = min_id + (i * rangeSize);
      const endId = Math.min(startId + rangeSize - 1, max_id);
      
      ranges.push({ startId, endId, scriptId: i + 1 });
    }
    
    return ranges;
  } catch (error) {
    log('❌ Error getting company ID ranges', { error: error.message });
    throw error;
  }
}

// Monitor progress of all scripts
async function monitorProgress(processes) {
  const interval = setInterval(async () => {
    try {
      const result = await pool.query(`
        SELECT COUNT(*) as remaining
        FROM companies 
        WHERE website IS NOT NULL 
        AND website != '' 
        AND website != '""'
        AND (favicon_url IS NULL OR favicon_url = '')
      `);
      
      const remaining = parseInt(result.rows[0].remaining);
      const activeProcesses = processes.filter(p => !p.killed && p.exitCode === null).length;
      
      log(`📈 Progress Monitor: ${remaining} companies remaining, ${activeProcesses} scripts active`);
      
      if (remaining === 0 || activeProcesses === 0) {
        clearInterval(interval);
      }
    } catch (error) {
      log('⚠️ Progress monitoring error', { error: error.message });
    }
  }, CONFIG.MONITORING_INTERVAL);
  
  return interval;
}

// Main parallel launcher
async function launchParallelProcessing() {
  const startTime = Date.now();
  log('🚀 Starting Favicon Parallel Launcher - MAXIMUM SPEED MODE');
  
  try {
    // First, add the favicon column if it doesn't exist
    await pool.query(`
      ALTER TABLE companies 
      ADD COLUMN IF NOT EXISTS favicon_url TEXT,
      ADD COLUMN IF NOT EXISTS favicon_last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    `);
    log('✅ Database schema verified');
    
    // Create the range processor script
    const processorPath = await createRangeProcessor();
    log(`📝 Created range processor: ${processorPath}`);
    
    // Get ID ranges for parallel processing
    const ranges = await getCompanyIdRanges();
    
    if (ranges.length === 0) {
      log('ℹ️ No companies need favicon updates');
      return { total: 0, processed: 0, updated: 0, errors: 0 };
    }
    
    log(`🔥 Launching ${ranges.length} parallel scripts for maximum speed`);
    
    // Launch parallel processes
    const processes = [];
    const results = [];
    
    for (const range of ranges) {
      log(`🚀 Launching Script ${range.scriptId}: Processing IDs ${range.startId} to ${range.endId}`);
      
      const process = spawn('node', [
        processorPath,
        range.startId.toString(),
        range.endId.toString(),
        range.scriptId.toString()
      ], {
        stdio: 'pipe',
        timeout: CONFIG.SCRIPT_TIMEOUT
      });
      
      process.stdout.on('data', (data) => {
        log(`Script ${range.scriptId}: ${data.toString().trim()}`);
      });
      
      process.stderr.on('data', (data) => {
        log(`Script ${range.scriptId} ERROR: ${data.toString().trim()}`);
      });
      
      processes.push({ process, range });
    }
    
    // Start progress monitoring
    const progressMonitor = await monitorProgress(processes.map(p => p.process));
    
    // Wait for all processes to complete
    const processPromises = processes.map(({ process, range }) => {
      return new Promise((resolve) => {
        process.on('close', (code) => {
          log(`Script ${range.scriptId}: Exited with code ${code}`);
          resolve({ range, code });
        });
        
        process.on('error', (error) => {
          log(`Script ${range.scriptId}: Process error`, { error: error.message });
          resolve({ range, code: -1, error: error.message });
        });
      });
    });
    
    const processResults = await Promise.all(processPromises);
    clearInterval(progressMonitor);
    
    // Get final statistics
    const finalResult = await pool.query(`
      SELECT 
        COUNT(*) as total_with_websites,
        COUNT(CASE WHEN favicon_url IS NOT NULL AND favicon_url != '' THEN 1 END) as with_favicons
      FROM companies 
      WHERE website IS NOT NULL 
      AND website != '' 
      AND website != '""'
    `);
    
    const { total_with_websites, with_favicons } = finalResult.rows[0];
    const totalDuration = Math.round((Date.now() - startTime) / 1000);
    const overallRate = Math.round(parseInt(with_favicons) / totalDuration);
    const successRate = Math.round((parseInt(with_favicons) / parseInt(total_with_websites)) * 100);
    
    const summary = {
      total_companies: parseInt(total_with_websites),
      companies_with_favicons: parseInt(with_favicons),
      processing_duration: totalDuration,
      processing_rate: overallRate,
      success_rate: successRate,
      parallel_scripts: ranges.length,
      script_results: processResults
    };
    
    log('🎉 Parallel Favicon Processing Completed!');
    log(`📊 FINAL RESULTS:`);
    log(`   Total Companies with Websites: ${summary.total_companies}`);
    log(`   Companies with Favicons: ${summary.companies_with_favicons}`);
    log(`   Processing Duration: ${summary.processing_duration} seconds`);
    log(`   Processing Rate: ${summary.processing_rate} companies/second`);
    log(`   Success Rate: ${summary.success_rate}%`);
    log(`   Parallel Scripts Used: ${summary.parallel_scripts}`);
    
    // Save results
    const resultsFile = path.join(logDir, `favicon-parallel-results-${new Date().toISOString().split('T')[0]}.json`);
    fs.writeFileSync(resultsFile, JSON.stringify(summary, null, 2));
    log(`💾 Results saved to: ${resultsFile}`);
    
    // Cleanup
    try {
      fs.unlinkSync(processorPath);
      log('🧹 Cleaned up temporary processor script');
    } catch (error) {
      log('⚠️ Could not cleanup processor script', { error: error.message });
    }
    
    return summary;
    
  } catch (error) {
    log('❌ FATAL ERROR in Parallel Launcher', { error: error.message });
    throw error;
  } finally {
    await pool.end();
  }
}

// Command line execution
if (import.meta.url === \`file://\${process.argv[1]}\`) {
  launchParallelProcessing().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { launchParallelProcessing };
