#!/usr/bin/env node

/**
 * PROGRESS MONITOR
 * 
 * Monitors the progress of the URL discovery automation
 * and provides real-time updates on success rates and findings.
 */

import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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

async function getProgressStats() {
  try {
    // Get total companies
    const totalResult = await pool.query('SELECT COUNT(*) as total FROM companies');
    const total = parseInt(totalResult.rows[0].total);
    
    // Get companies with websites
    const withWebsiteResult = await pool.query(`
      SELECT COUNT(*) as with_website 
      FROM companies 
      WHERE website IS NOT NULL AND website != '' AND website != '""'
    `);
    const withWebsite = parseInt(withWebsiteResult.rows[0].with_website);
    
    // Get companies without websites
    const withoutWebsite = total - withWebsite;
    
    // Get recently updated (today)
    const todayResult = await pool.query(`
      SELECT COUNT(*) as updated_today 
      FROM companies 
      WHERE website IS NOT NULL 
      AND website != '' 
      AND website != '""'
      AND updated_at >= CURRENT_DATE
    `);
    const updatedToday = parseInt(todayResult.rows[0].updated_today);
    
    // Get some recent URLs found
    const recentResult = await pool.query(`
      SELECT company_name, website, updated_at
      FROM companies 
      WHERE website IS NOT NULL 
      AND website != '' 
      AND website != '""'
      AND updated_at >= CURRENT_DATE
      ORDER BY updated_at DESC
      LIMIT 10
    `);
    
    return {
      total,
      withWebsite,
      withoutWebsite,
      updatedToday,
      recentUrls: recentResult.rows,
      completionRate: Math.round((withWebsite / total) * 100),
      todaySuccessRate: updatedToday > 0 ? Math.round((updatedToday / (updatedToday + withoutWebsite)) * 100) : 0
    };
    
  } catch (error) {
    console.error('Error getting progress stats:', error.message);
    return null;
  }
}

async function checkLogFiles() {
  const logDir = path.join(__dirname, '../logs');
  const today = new Date().toISOString().split('T')[0];
  const logFile = path.join(logDir, `google-places-finder-${today}.log`);
  
  if (fs.existsSync(logFile)) {
    const stats = fs.statSync(logFile);
    const content = fs.readFileSync(logFile, 'utf8');
    const lines = content.split('\n');
    
    // Count different types of log entries
    const successCount = lines.filter(line => line.includes('✅ SUCCESS:')).length;
    const failedCount = lines.filter(line => line.includes('❌ FAILED:')).length;
    const processedCount = lines.filter(line => line.includes('🏢 Processing:')).length;
    
    return {
      fileSize: Math.round(stats.size / 1024), // KB
      totalLines: lines.length,
      successCount,
      failedCount,
      processedCount,
      lastModified: stats.mtime
    };
  }
  
  return null;
}

async function displayProgress() {
  console.clear();
  console.log('🚀 JUST-WORK URL DISCOVERY - LIVE PROGRESS MONITOR');
  console.log('=' .repeat(60));
  console.log();
  
  const stats = await getProgressStats();
  const logStats = await checkLogFiles();
  
  if (stats) {
    console.log('📊 DATABASE STATISTICS:');
    console.log(`   Total Companies: ${stats.total.toLocaleString()}`);
    console.log(`   With Websites: ${stats.withWebsite.toLocaleString()} (${stats.completionRate}%)`);
    console.log(`   Without Websites: ${stats.withoutWebsite.toLocaleString()}`);
    console.log(`   Updated Today: ${stats.updatedToday.toLocaleString()}`);
    console.log();
  }
  
  if (logStats) {
    console.log('📝 AUTOMATION PROGRESS:');
    console.log(`   Companies Processed: ${logStats.processedCount.toLocaleString()}`);
    console.log(`   URLs Found: ${logStats.successCount.toLocaleString()}`);
    console.log(`   Failed Searches: ${logStats.failedCount.toLocaleString()}`);
    console.log(`   Log File Size: ${logStats.fileSize} KB`);
    console.log(`   Last Activity: ${logStats.lastModified.toLocaleTimeString()}`);
    
    if (logStats.processedCount > 0) {
      const currentSuccessRate = Math.round((logStats.successCount / logStats.processedCount) * 100);
      console.log(`   Current Success Rate: ${currentSuccessRate}%`);
    }
    console.log();
  }
  
  if (stats && stats.recentUrls.length > 0) {
    console.log('🔗 RECENT URLs FOUND:');
    stats.recentUrls.forEach((company, index) => {
      const time = new Date(company.updated_at).toLocaleTimeString();
      console.log(`   ${index + 1}. ${company.company_name} → ${company.website} (${time})`);
    });
    console.log();
  }
  
  console.log(`⏰ Last Updated: ${new Date().toLocaleTimeString()}`);
  console.log('Press Ctrl+C to stop monitoring');
}

// Main monitoring loop
async function startMonitoring() {
  console.log('🚀 Starting progress monitor...');
  
  // Display initial progress
  await displayProgress();
  
  // Update every 30 seconds
  const interval = setInterval(async () => {
    await displayProgress();
  }, 30000);
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n👋 Stopping progress monitor...');
    clearInterval(interval);
    pool.end().then(() => {
      process.exit(0);
    });
  });
}

// Start monitoring
startMonitoring().catch(error => {
  console.error('Monitor error:', error);
  process.exit(1);
});
