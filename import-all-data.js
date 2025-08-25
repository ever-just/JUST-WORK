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

async function importAllCompanies() {
  console.log('🏢 Importing ALL companies (7,026 total)...');
  
  try {
    const companiesFile = path.join(__dirname, 'DATA/CLEANED_companies.csv');
    const companies = [];
    
    await new Promise((resolve, reject) => {
      fs.createReadStream(companiesFile)
        .pipe(csv())
        .on('data', (row) => {
          companies.push(row);
        })
        .on('end', resolve)
        .on('error', reject);
    });
    
    console.log(`📊 Processing ${companies.length} companies...`);
    
    // Clear existing data first
    await pool.query('DELETE FROM companies');
    console.log('🗑️  Cleared existing companies');
    
    let inserted = 0;
    let errors = 0;
    
    // Process in batches of 50 to avoid timeouts
    const batchSize = 50;
    for (let i = 0; i < companies.length; i += batchSize) {
      const batch = companies.slice(i, i + batchSize);
      
      for (const company of batch) {
        try {
          await pool.query(`
            INSERT INTO companies (
              duns_number, company_name, tradestyle, address_line_1, address_line_2,
              city, state, postal_code, phone, website,
              revenue_raw, revenue_numeric, revenue_formatted,
              employees_total, employees_single_site, business_description,
              industry, ownership_type, entity_type, is_headquarters
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
            ON CONFLICT (duns_number) DO UPDATE SET
              company_name = EXCLUDED.company_name,
              tradestyle = EXCLUDED.tradestyle,
              address_line_1 = EXCLUDED.address_line_1,
              city = EXCLUDED.city,
              state = EXCLUDED.state,
              revenue_formatted = EXCLUDED.revenue_formatted,
              employees_total = EXCLUDED.employees_total,
              business_description = EXCLUDED.business_description,
              industry = EXCLUDED.industry
          `, [
            company.duns_number,
            company.company_name,
            company.tradestyle || null,
            company.address_line_1 || null,
            company.address_line_2 || null,
            company.city,
            company.state,
            company.postal_code,
            company.phone || null,
            company.website || null,
            company.revenue_raw || null,
            parseFloat(company.revenue_numeric) || null,
            company.revenue_formatted || null,
            parseInt(company.employees_total) || null,
            parseInt(company.employees_single_site) || null,
            company.business_description || null,
            company.industry || null,
            company.ownership_type || null,
            company.entity_type || null,
            company.is_headquarters === 'true'
          ]);
          
          inserted++;
        } catch (error) {
          errors++;
          if (errors < 10) { // Only show first 10 errors
            console.error(`❌ Error inserting ${company.company_name}:`, error.message);
          }
        }
      }
      
      console.log(`  ✅ Processed ${Math.min(i + batchSize, companies.length)}/${companies.length} companies...`);
      
      // Small delay between batches to prevent overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`🎉 Companies import complete!`);
    console.log(`✅ Successfully inserted: ${inserted}`);
    console.log(`❌ Errors: ${errors}`);
    
    // Verify
    const result = await pool.query('SELECT COUNT(*) FROM companies');
    console.log(`📊 Total companies in database: ${result.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Companies import failed:', error);
  }
}

async function importAllContacts() {
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
    
    // Process in batches of 50
    const batchSize = 50;
    for (let i = 0; i < contacts.length; i += batchSize) {
      const batch = contacts.slice(i, i + batchSize);
      
      for (const contact of batch) {
        try {
          await pool.query(`
            INSERT INTO contacts (
              duns_number, first_name, last_name, title, email, direct_phone,
              company_name, city, state
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `, [
            contact.duns_number,
            contact.first_name || null,
            contact.last_name || null,
            contact.title || null,
            contact.email || null,
            contact.direct_phone || null,
            contact.company_name,
            contact.city,
            contact.state
          ]);
          
          inserted++;
        } catch (error) {
          errors++;
          if (errors < 10) { // Only show first 10 errors
            console.error(`❌ Error inserting contact ${contact.first_name} ${contact.last_name}:`, error.message);
          }
        }
      }
      
      console.log(`  ✅ Processed ${Math.min(i + batchSize, contacts.length)}/${contacts.length} contacts...`);
      
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`🎉 Contacts import complete!`);
    console.log(`✅ Successfully inserted: ${inserted}`);
    console.log(`❌ Errors: ${errors}`);
    
    // Verify
    const result = await pool.query('SELECT COUNT(*) FROM contacts');
    console.log(`👥 Total contacts in database: ${result.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Contacts import failed:', error);
  }
}

async function updateCompanyContactCounts() {
  console.log('🔄 Updating company contact counts...');
  
  try {
    await pool.query(`
      UPDATE companies 
      SET contact_count = (
        SELECT COUNT(*) 
        FROM contacts 
        WHERE contacts.duns_number = companies.duns_number
      )
    `);
    
    const result = await pool.query(`
      SELECT 
        COUNT(*) as companies_with_contacts,
        AVG(contact_count) as avg_contacts_per_company
      FROM companies 
      WHERE contact_count > 0
    `);
    
    console.log(`✅ Updated contact counts`);
    console.log(`📊 Companies with contacts: ${result.rows[0].companies_with_contacts}`);
    console.log(`📊 Average contacts per company: ${parseFloat(result.rows[0].avg_contacts_per_company).toFixed(2)}`);
    
  } catch (error) {
    console.error('❌ Failed to update contact counts:', error);
  }
}

async function main() {
  try {
    console.log('🚀 Starting COMPLETE data import...');
    console.log('=====================================');
    
    await importAllCompanies();
    console.log('');
    await importAllContacts();
    console.log('');
    await updateCompanyContactCounts();
    
    console.log('');
    console.log('🎉 COMPLETE DATA IMPORT FINISHED!');
    console.log('=====================================');
    
    // Final verification
    const companiesResult = await pool.query('SELECT COUNT(*) FROM companies');
    const contactsResult = await pool.query('SELECT COUNT(*) FROM contacts');
    
    console.log(`📊 Final counts:`);
    console.log(`   Companies: ${companiesResult.rows[0].count}`);
    console.log(`   Contacts: ${contactsResult.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Import failed:', error);
  } finally {
    await pool.end();
  }
}

main();
