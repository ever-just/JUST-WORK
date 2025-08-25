#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import csv from 'csv-parser';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbConfig = {
  user: 'doadmin',
  host: 'just-work-db-do-user-24253030-0.f.db.ondigitalocean.com',
  database: 'justwork',
  password: process.env.DB_PASSWORD,
  port: 25060,
  ssl: { rejectUnauthorized: false }
};

const pool = new Pool(dbConfig);

async function importContacts() {
  console.log('👥 Importing ALL contacts (7,341 total)...');
  
  try {
    const contactsFile = path.join(__dirname, 'DATA/CLEANED_contacts.csv');
    const contacts = [];
    
    await new Promise((resolve, reject) => {
      fs.createReadStream(contactsFile)
        .pipe(csv())
        .on('data', (row) => {
          contacts.push(row);
        })
        .on('end', resolve)
        .on('error', reject);
    });
    
    console.log(`📊 Processing ${contacts.length} contacts...`);
    
    // Clear existing contacts first
    await pool.query('DELETE FROM contacts');
    console.log('🗑️  Cleared existing contacts');
    
    let inserted = 0;
    let errors = 0;
    
    // Process in batches of 100
    const batchSize = 100;
    for (let i = 0; i < contacts.length; i += batchSize) {
      const batch = contacts.slice(i, i + batchSize);
      
      for (const contact of batch) {
        try {
          const fullName = `${contact.first_name || ''} ${contact.last_name || ''}`.trim();
          
          await pool.query(`
            INSERT INTO contacts (
              duns_number, first_name, last_name, full_name, title, email_flag, phone_flag
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            contact.duns_number,
            contact.first_name || null,
            contact.last_name || null,
            fullName || 'Unknown',
            contact.title || null,
            contact.email ? 'Y' : 'N',
            contact.direct_phone ? 'Y' : 'N'
          ]);
          
          inserted++;
        } catch (error) {
          errors++;
          if (errors < 10) {
            console.error(`❌ Error inserting contact ${contact.first_name} ${contact.last_name}:`, error.message);
          }
        }
      }
      
      console.log(`  ✅ Processed ${Math.min(i + batchSize, contacts.length)}/${contacts.length} contacts...`);
      
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    console.log(`🎉 Contacts import complete!`);
    console.log(`✅ Successfully inserted: ${inserted}`);
    console.log(`❌ Errors: ${errors}`);
    
    // Verify
    const result = await pool.query('SELECT COUNT(*) FROM contacts');
    console.log(`👥 Total contacts in database: ${result.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Contacts import failed:', error);
  } finally {
    await pool.end();
  }
}

importContacts();
