#!/usr/bin/env node

/**
 * JUST-WORK Raw Data Processor
 * Processes raw D&B CSV data into cleaned companies and contacts files
 * 
 * Input: Raw D&B CSV with both company and contact data in each row
 * Output: 
 * - DATA/CLEANED_companies.csv (unique companies with aggregated contact info)
 * - DATA/CLEANED_contacts.csv (individual contacts linked to companies)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import csv from 'csv-parser';
import { createObjectCsvWriter } from 'csv-writer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Input file path
const inputFile = path.join(__dirname, '../private,independent,lessthan100employees, 500k-50M.csv');

// Output file paths
const companiesOutputFile = path.join(__dirname, '../DATA/CLEANED_companies.csv');
const contactsOutputFile = path.join(__dirname, '../DATA/CLEANED_contacts.csv');

// Ensure DATA directory exists
const dataDir = path.join(__dirname, '../DATA');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Maps to store unique companies and all contacts
const companiesMap = new Map();
const contactsArray = [];

// Title priority mapping (lower number = higher priority)
const titlePriority = {
  'ceo': 1, 'chief executive officer': 1, 'president': 2, 'coo': 3, 'chief operating officer': 3,
  'cfo': 4, 'chief financial officer': 4, 'cto': 5, 'chief technology officer': 5,
  'vp': 6, 'vice president': 6, 'director': 7, 'manager': 8, 'senior': 9, 'principal': 10
};

function getTitlePriority(title) {
  if (!title) return 15;
  const lowerTitle = title.toLowerCase();
  
  for (const [key, priority] of Object.entries(titlePriority)) {
    if (lowerTitle.includes(key)) {
      return priority;
    }
  }
  return 15; // Default priority for unrecognized titles
}

function formatRevenue(salesUSD) {
  if (!salesUSD || salesUSD === '') return null;
  
  // Handle scientific notation (e.g., "1.06566E11")
  if (salesUSD.includes('E')) {
    const numericValue = parseFloat(salesUSD);
    if (isNaN(numericValue)) return null;
    
    // Format as human-readable
    if (numericValue >= 1e9) {
      return `$${(numericValue / 1e9).toFixed(1)}B`;
    } else if (numericValue >= 1e6) {
      return `$${(numericValue / 1e6).toFixed(1)}M`;
    } else if (numericValue >= 1e3) {
      return `$${(numericValue / 1e3).toFixed(1)}K`;
    } else {
      return `$${numericValue.toFixed(0)}`;
    }
  }
  
  return salesUSD;
}

function processRow(row) {
  const dunsNumber = row['D-U-N-S® Number'];
  const companyName = row['Company Name'];
  const firstName = row['First Name'];
  const lastName = row['Last Name'];
  const title = row['Title'];
  const email = row['Email'];
  const directPhone = row['Direct Phone'];
  
  // Skip rows without essential data
  if (!dunsNumber || !companyName) {
    return;
  }
  
  // Process company data (aggregate by DUNS number)
  if (!companiesMap.has(dunsNumber)) {
    const revenueNumeric = parseFloat(row['Sales (USD)']) || null;
    
    companiesMap.set(dunsNumber, {
      duns_number: dunsNumber,
      company_name: companyName,
      tradestyle: row['Tradestyle'] || '',
      address_line_1: row['Address Line 1'] || '',
      address_line_2: row['Address Line 2'] || '',
      city: row['City'] || '',
      state: row['State Or Province'] || '',
      postal_code: row['Postal Code'] || '',
      phone: row['Phone'] || '',
      website: row['URL'] || '',
      revenue_raw: row['Sales (USD)'] || '',
      revenue_numeric: revenueNumeric,
      revenue_formatted: formatRevenue(row['Sales (USD)']),
      employees_total: parseInt(row['Employees (Total)']) || null,
      employees_single_site: parseInt(row['Employees (Single Site)']) || null,
      business_description: row['Business Description'] || '',
      industry: row['D&B Hoovers Industry'] || '',
      ownership_type: row['Ownership Type'] || '',
      entity_type: row['Entity Type'] || '',
      is_headquarters: row['Is Headquarters'] === 'true',
      contact_count: 0, // Will be calculated later
      primary_contact_name: '',
      primary_contact_title: '',
      primary_contact_email_flag: '',
      primary_contact_phone_flag: '',
      contacts: [] // Temporary array to track contacts for this company
    });
  }
  
  // Process contact data (if contact information exists)
  if (firstName || lastName || title) {
    const fullName = `${firstName || ''} ${lastName || ''}`.trim();
    const contactPriority = getTitlePriority(title);
    
    const contact = {
      duns_number: dunsNumber,
      first_name: firstName || '',
      last_name: lastName || '',
      full_name: fullName,
      title: title || '',
      email_flag: email || '',
      phone_flag: directPhone || '',
      is_primary: false, // Will be determined later
      title_priority: contactPriority
    };
    
    contactsArray.push(contact);
    
    // Add to company's contact list for primary contact determination
    const company = companiesMap.get(dunsNumber);
    company.contacts.push(contact);
  }
}

async function processData() {
  console.log('🔄 Processing raw D&B data...');
  console.log(`📁 Input file: ${inputFile}`);
  
  return new Promise((resolve, reject) => {
    let rowCount = 0;
    
    fs.createReadStream(inputFile)
      .pipe(csv())
      .on('data', (row) => {
        rowCount++;
        processRow(row);
        
        if (rowCount % 1000 === 0) {
          console.log(`📊 Processed ${rowCount} rows...`);
        }
      })
      .on('end', () => {
        console.log(`✅ Finished processing ${rowCount} rows`);
        console.log(`🏢 Found ${companiesMap.size} unique companies`);
        console.log(`👥 Found ${contactsArray.length} contacts`);
        resolve();
      })
      .on('error', reject);
  });
}

function determinePrimaryContacts() {
  console.log('🎯 Determining primary contacts...');
  
  for (const [dunsNumber, company] of companiesMap) {
    if (company.contacts.length > 0) {
      // Sort contacts by title priority (lower number = higher priority)
      company.contacts.sort((a, b) => a.title_priority - b.title_priority);
      
      // Set the first contact as primary
      const primaryContact = company.contacts[0];
      primaryContact.is_primary = true;
      
      // Update company with primary contact info
      company.contact_count = company.contacts.length;
      company.primary_contact_name = primaryContact.full_name;
      company.primary_contact_title = primaryContact.title;
      company.primary_contact_email_flag = primaryContact.email_flag ? 'Y' : 'N';
      company.primary_contact_phone_flag = primaryContact.phone_flag ? 'Y' : 'N';
    }
    
    // Remove temporary contacts array
    delete company.contacts;
  }
  
  // Update the contacts array with primary flags
  for (const contact of contactsArray) {
    const company = companiesMap.get(contact.duns_number);
    if (company && company.primary_contact_name === contact.full_name) {
      contact.is_primary = true;
    }
  }
}

async function writeCleanedFiles() {
  console.log('💾 Writing cleaned CSV files...');
  
  // Write companies file
  const companiesWriter = createObjectCsvWriter({
    path: companiesOutputFile,
    header: [
      { id: 'duns_number', title: 'duns_number' },
      { id: 'company_name', title: 'company_name' },
      { id: 'tradestyle', title: 'tradestyle' },
      { id: 'address_line_1', title: 'address_line_1' },
      { id: 'address_line_2', title: 'address_line_2' },
      { id: 'city', title: 'city' },
      { id: 'state', title: 'state' },
      { id: 'postal_code', title: 'postal_code' },
      { id: 'phone', title: 'phone' },
      { id: 'website', title: 'website' },
      { id: 'revenue_raw', title: 'revenue_raw' },
      { id: 'revenue_numeric', title: 'revenue_numeric' },
      { id: 'revenue_formatted', title: 'revenue_formatted' },
      { id: 'employees_total', title: 'employees_total' },
      { id: 'employees_single_site', title: 'employees_single_site' },
      { id: 'business_description', title: 'business_description' },
      { id: 'industry', title: 'industry' },
      { id: 'ownership_type', title: 'ownership_type' },
      { id: 'entity_type', title: 'entity_type' },
      { id: 'is_headquarters', title: 'is_headquarters' },
      { id: 'contact_count', title: 'contact_count' },
      { id: 'primary_contact_name', title: 'primary_contact_name' },
      { id: 'primary_contact_title', title: 'primary_contact_title' },
      { id: 'primary_contact_email_flag', title: 'primary_contact_email_flag' },
      { id: 'primary_contact_phone_flag', title: 'primary_contact_phone_flag' }
    ]
  });
  
  const companiesData = Array.from(companiesMap.values());
  await companiesWriter.writeRecords(companiesData);
  console.log(`✅ Written ${companiesData.length} companies to ${companiesOutputFile}`);
  
  // Write contacts file
  const contactsWriter = createObjectCsvWriter({
    path: contactsOutputFile,
    header: [
      { id: 'duns_number', title: 'duns_number' },
      { id: 'first_name', title: 'first_name' },
      { id: 'last_name', title: 'last_name' },
      { id: 'full_name', title: 'full_name' },
      { id: 'title', title: 'title' },
      { id: 'email_flag', title: 'email_flag' },
      { id: 'phone_flag', title: 'phone_flag' },
      { id: 'is_primary', title: 'is_primary' },
      { id: 'title_priority', title: 'title_priority' }
    ]
  });
  
  await contactsWriter.writeRecords(contactsArray);
  console.log(`✅ Written ${contactsArray.length} contacts to ${contactsOutputFile}`);
}

async function main() {
  try {
    console.log('🚀 Starting JUST-WORK data processing...');
    console.log('=====================================');
    
    // Check if input file exists
    if (!fs.existsSync(inputFile)) {
      throw new Error(`Input file not found: ${inputFile}`);
    }
    
    await processData();
    determinePrimaryContacts();
    await writeCleanedFiles();
    
    console.log('=====================================');
    console.log('🎉 Data processing completed successfully!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Run: npm run db:setup (to create database tables)');
    console.log('2. Run: npm run db:import (to import the cleaned data)');
    console.log('3. Update backend to connect to real database');
    
  } catch (error) {
    console.error('❌ Error processing data:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
