#!/usr/bin/env node

/**
 * JUST-WORK CSV Data Import Script
 * Imports cleaned CSV data into PostgreSQL database
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import csv from 'csv-parser';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database configuration
const dbConfig = {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'justwork',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
};

const pool = new Pool(dbConfig);

// File paths
const companiesFile = path.join(__dirname, '../../DATA/CLEANED_companies.csv');
const contactsFile = path.join(__dirname, '../../DATA/CLEANED_contacts.csv');

async function importCompanies() {
  console.log('🏢 Importing companies data...');
  
  const companies = [];
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(companiesFile)
      .pipe(csv())
      .on('data', (row) => {
        companies.push({
          duns_number: row.duns_number,
          company_name: row.company_name,
          tradestyle: row.tradestyle || null,
          address_line_1: row.address_line_1 || null,
          address_line_2: row.address_line_2 || null,
          city: row.city,
          state: row.state,
          postal_code: row.postal_code,
          phone: row.phone || null,
          website: row.website || null,
          revenue_raw: row.revenue_raw,
          revenue_numeric: parseFloat(row.revenue_numeric) || null,
          revenue_formatted: row.revenue_formatted || null,
          employees_total: parseInt(row.employees_total) || null,
          employees_single_site: parseInt(row.employees_single_site) || null,
          business_description: row.business_description,
          industry: row.industry,
          ownership_type: row.ownership_type,
          entity_type: row.entity_type,
          is_headquarters: row.is_headquarters === 'true',
          contact_count: parseInt(row.contact_count) || 0,
          primary_contact_name: row.primary_contact_name || null,
          primary_contact_title: row.primary_contact_title || null,
          primary_contact_email_flag: row.primary_contact_email_flag || null,
          primary_contact_phone_flag: row.primary_contact_phone_flag || null,
        });
      })
      .on('end', async () => {
        try {
          console.log(`📊 Parsed ${companies.length} companies`);
          
          // Insert companies in batches
          const batchSize = 100;
          let inserted = 0;
          
          for (let i = 0; i < companies.length; i += batchSize) {
            const batch = companies.slice(i, i + batchSize);
            
            const values = batch.map((company, index) => {
              const baseIndex = i * 25; // 25 fields per company
              const placeholders = Array.from({ length: 25 }, (_, j) => `$${baseIndex + index * 25 + j + 1}`).join(', ');
              return `(${placeholders})`;
            }).join(', ');
            
            const flatValues = batch.flatMap(company => [
              company.duns_number,
              company.company_name,
              company.tradestyle,
              company.address_line_1,
              company.address_line_2,
              company.city,
              company.state,
              company.postal_code,
              company.phone,
              company.website,
              company.revenue_raw,
              company.revenue_numeric,
              company.revenue_formatted,
              company.employees_total,
              company.employees_single_site,
              company.business_description,
              company.industry,
              company.ownership_type,
              company.entity_type,
              company.is_headquarters,
              company.contact_count,
              company.primary_contact_name,
              company.primary_contact_title,
              company.primary_contact_email_flag,
              company.primary_contact_phone_flag,
            ]);
            
            const query = `
              INSERT INTO companies (
                duns_number, company_name, tradestyle, address_line_1, address_line_2,
                city, state, postal_code, phone, website, revenue_raw, revenue_numeric,
                revenue_formatted, employees_total, employees_single_site, business_description,
                industry, ownership_type, entity_type, is_headquarters, contact_count,
                primary_contact_name, primary_contact_title, primary_contact_email_flag,
                primary_contact_phone_flag
              ) VALUES ${values}
              ON CONFLICT (duns_number) DO NOTHING
            `;
            
            await pool.query(query, flatValues);
            inserted += batch.length;
            console.log(`✅ Inserted ${inserted}/${companies.length} companies`);
          }
          
          resolve(inserted);
        } catch (error) {
          reject(error);
        }
      })
      .on('error', reject);
  });
}

async function importContacts() {
  console.log('👥 Importing contacts data...');
  
  const contacts = [];
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(contactsFile)
      .pipe(csv())
      .on('data', (row) => {
        contacts.push({
          duns_number: row.duns_number,
          first_name: row.first_name || null,
          last_name: row.last_name || null,
          full_name: row.full_name,
          title: row.title || null,
          email_flag: row.email_flag || null,
          phone_flag: row.phone_flag || null,
          is_primary: row.is_primary === 'True',
          title_priority: parseInt(row.title_priority) || 5,
        });
      })
      .on('end', async () => {
        try {
          console.log(`📊 Parsed ${contacts.length} contacts`);
          
          // Insert contacts in batches
          const batchSize = 100;
          let inserted = 0;
          
          for (let i = 0; i < contacts.length; i += batchSize) {
            const batch = contacts.slice(i, i + batchSize);
            
            const values = batch.map((_, index) => {
              const placeholders = Array.from({ length: 9 }, (_, j) => `$${index * 9 + j + 1}`).join(', ');
              return `(${placeholders})`;
            }).join(', ');
            
            const flatValues = batch.flatMap(contact => [
              contact.duns_number,
              contact.first_name,
              contact.last_name,
              contact.full_name,
              contact.title,
              contact.email_flag,
              contact.phone_flag,
              contact.is_primary,
              contact.title_priority,
            ]);
            
            const query = `
              INSERT INTO contacts (
                duns_number, first_name, last_name, full_name, title,
                email_flag, phone_flag, is_primary, title_priority
              ) VALUES ${values}
            `;
            
            await pool.query(query, flatValues);
            inserted += batch.length;
            console.log(`✅ Inserted ${inserted}/${contacts.length} contacts`);
          }
          
          resolve(inserted);
        } catch (error) {
          reject(error);
        }
      })
      .on('error', reject);
  });
}

async function verifyImport() {
  console.log('🔍 Verifying import results...');
  
  const companyStats = await pool.query(`
    SELECT 
      COUNT(*) as total_companies,
      COUNT(CASE WHEN revenue_numeric IS NOT NULL THEN 1 END) as with_revenue,
      COUNT(CASE WHEN website IS NOT NULL THEN 1 END) as with_website,
      COUNT(CASE WHEN primary_contact_name IS NOT NULL THEN 1 END) as with_primary_contact
    FROM companies
  `);
  
  const contactStats = await pool.query(`
    SELECT 
      COUNT(*) as total_contacts,
      COUNT(CASE WHEN is_primary = true THEN 1 END) as primary_contacts,
      COUNT(CASE WHEN email_flag = 'Y' THEN 1 END) as with_email,
      COUNT(CASE WHEN phone_flag = 'Y' THEN 1 END) as with_phone
    FROM contacts
  `);
  
  console.log('📈 Import Results:');
  console.log('Companies:', companyStats.rows[0]);
  console.log('Contacts:', contactStats.rows[0]);
  
  // Sample data verification
  const sampleCompanies = await pool.query(`
    SELECT company_name, city, revenue_formatted, industry
    FROM companies 
    WHERE revenue_numeric IS NOT NULL 
    ORDER BY revenue_numeric DESC 
    LIMIT 3
  `);
  
  console.log('🏆 Top Companies by Revenue:');
  sampleCompanies.rows.forEach(company => {
    console.log(`  ${company.company_name} (${company.city}) - ${company.revenue_formatted} - ${company.industry}`);
  });
}

async function main() {
  try {
    console.log('🚀 Starting JUST-WORK data import...');
    console.log('📁 Database:', dbConfig.database);
    console.log('🏢 Companies file:', companiesFile);
    console.log('👥 Contacts file:', contactsFile);
    
    // Check if files exist
    if (!fs.existsSync(companiesFile)) {
      throw new Error(`Companies file not found: ${companiesFile}`);
    }
    if (!fs.existsSync(contactsFile)) {
      throw new Error(`Contacts file not found: ${contactsFile}`);
    }
    
    // Test database connection
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful');
    
    // Import data
    const companiesImported = await importCompanies();
    const contactsImported = await importContacts();
    
    // Verify results
    await verifyImport();
    
    console.log('🎉 Import completed successfully!');
    console.log(`📊 Final counts: ${companiesImported} companies, ${contactsImported} contacts`);
    
  } catch (error) {
    console.error('❌ Import failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { importCompanies, importContacts, verifyImport };
