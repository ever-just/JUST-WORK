#!/usr/bin/env node

import pg from 'pg';

const { Pool } = pg;

const dbConfig = {
  user: 'doadmin',
  host: 'just-work-db-do-user-24253030-0.f.db.ondigitalocean.com',
  database: 'justwork',
  password: process.env.DB_PASSWORD,
  port: 25060,
  ssl: { rejectUnauthorized: false }
};

const pool = new Pool(dbConfig);

async function checkContactsSchema() {
  try {
    console.log('🔍 Checking contacts table schema...');
    
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'contacts' 
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Contacts table columns:');
    result.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });
    
  } catch (error) {
    console.error('❌ Schema check failed:', error.message);
  } finally {
    await pool.end();
  }
}

checkContactsSchema();
