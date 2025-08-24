#!/usr/bin/env node

/**
 * JUST-WORK Backend API Server
 * Serves company data from PostgreSQL database
 */

import express from 'express';
import cors from 'cors';
import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

const { Pool } = pg;
const app = express();
const PORT = process.env.PORT || 3001;

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Data storage
let companiesData = [];
let contactsData = [];
let industriesData = [];

// Database configuration
const dbConfig = {
  user: process.env.DB_USER || 'doadmin',
  host: process.env.DB_HOST || 'ae5d107f-9867-42f1-be95-61fdbe5954cb-do-user-18665984-0.c.db.ondigitalocean.com',
  database: process.env.DB_NAME || 'justwork',
  password: process.env.DB_PASSWORD || 'justwork2024',
  port: process.env.DB_PORT || 25060,
  ssl: {
    rejectUnauthorized: false
  }
};

const pool = new Pool(dbConfig);

// Load data from cleaned CSV files
async function loadCompaniesData() {
  console.log('📊 Loading companies data from CSV...');
  const companiesFile = path.join(__dirname, '../DATA/CLEANED_companies.csv');
  
  return new Promise((resolve, reject) => {
    const companies = [];
    
    fs.createReadStream(companiesFile)
      .pipe(csv())
      .on('data', (row) => {
        companies.push({
          name: row.company_name,
          tradestyle: row.tradestyle || '',
          address: row.address_line_1 || '',
          city: row.city || '',
          state: row.state || '',
          postalCode: row.postal_code || '',
          phone: row.phone || '',
          url: row.website || '',
          sales: row.revenue_formatted || row.revenue_raw || '',
          employees: row.employees_total || '',
          description: row.business_description || '',
          industry: row.industry || '',
          isHeadquarters: row.is_headquarters === 'true',
          ownership: row.ownership_type || '',
          entity_type: row.entity_type || '',
          revenue_numeric: parseFloat(row.revenue_numeric) || 0,
          employeesSite: row.employees_single_site || '',
          dunsNumber: row.duns_number,
          contactCount: parseInt(row.contact_count) || 0,
          primaryContactName: row.primary_contact_name || '',
          primaryContactTitle: row.primary_contact_title || ''
        });
      })
      .on('end', () => {
        console.log(`✅ Loaded ${companies.length} companies`);
        companiesData = companies;
        resolve(companies);
      })
      .on('error', reject);
  });
}

async function loadContactsData() {
  console.log('👥 Loading contacts data from CSV...');
  const contactsFile = path.join(__dirname, '../DATA/CLEANED_contacts.csv');
  
  return new Promise((resolve, reject) => {
    const contacts = [];
    
    fs.createReadStream(contactsFile)
      .pipe(csv())
      .on('data', (row) => {
        contacts.push({
          dunsNumber: row.duns_number,
          firstName: row.first_name || '',
          lastName: row.last_name || '',
          fullName: row.full_name || '',
          title: row.title || '',
          emailFlag: row.email_flag || '',
          phoneFlag: row.phone_flag || '',
          isPrimary: row.is_primary === 'true',
          titlePriority: parseInt(row.title_priority) || 15
        });
      })
      .on('end', () => {
        console.log(`✅ Loaded ${contacts.length} contacts`);
        contactsData = contacts;
        resolve(contacts);
      })
      .on('error', reject);
  });
}

function generateIndustriesData() {
  console.log('🏭 Generating industries list...');
  const industries = new Set();
  
  companiesData.forEach(company => {
    if (company.industry && company.industry.trim()) {
      industries.add(company.industry.trim());
    }
  });
  
  industriesData = Array.from(industries)
    .sort()
    .map(industry => ({
      value: industry,
      label: industry
    }));
    
  console.log(`✅ Generated ${industriesData.length} unique industries`);
}

// Sample data for demonstration (will be replaced with real database)
const sampleCompanies = [
  {
    name: "EverJust Technologies",
    tradestyle: "EverJust",
    address: "123 Innovation Drive",
    city: "Minneapolis",
    state: "MN",
    postalCode: "55401",
    phone: "(612) 555-0123",
    url: "https://everjust.com",
    sales: "$50.0M",
    employees: "250",
    description: "Leading technology consulting and development firm specializing in AI solutions, web development, and digital transformation.",
    industry: "Technology Services",
    isHeadquarters: true,
    ownership: "Private",
    entity_type: "Corporation",
    revenue_numeric: 50000000,
    employeesSite: "250"
  },
  {
    name: "Twin Cities Auto Auction",
    tradestyle: "TCAA",
    address: "456 Commerce Blvd",
    city: "St. Paul",
    state: "MN", 
    postalCode: "55102",
    phone: "(651) 555-0456",
    url: "https://tcaa.com",
    sales: "$12.5M",
    employees: "45",
    description: "Premier automotive auction house serving the Twin Cities metro area with direct-to-consumer vehicle sales.",
    industry: "Automotive",
    isHeadquarters: true,
    ownership: "Private",
    entity_type: "LLC",
    revenue_numeric: 12500000,
    employeesSite: "45"
  },
  {
    name: "Minnesota Business Solutions",
    tradestyle: "MN BizSol",
    address: "789 Corporate Center",
    city: "Bloomington",
    state: "MN",
    postalCode: "55425",
    phone: "(952) 555-0789",
    url: "https://mnbizsol.com",
    sales: "$25.8M",
    employees: "120",
    description: "Full-service business consulting firm providing strategic planning, operations optimization, and growth acceleration services.",
    industry: "Business Services",
    isHeadquarters: true,
    ownership: "Private",
    entity_type: "Corporation",
    revenue_numeric: 25800000,
    employeesSite: "120"
  }
];

const sampleIndustries = [
  { value: "Technology Services", label: "Technology Services" },
  { value: "Automotive", label: "Automotive" },
  { value: "Business Services", label: "Business Services" },
  { value: "Healthcare", label: "Healthcare" },
  { value: "Manufacturing", label: "Manufacturing" },
  { value: "Financial Services", label: "Financial Services" }
];

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'JUST-WORK API'
  });
});

// Get all companies with pagination and filtering
app.get('/api/companies', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      search = '',
      industry = ''
    } = req.query;

    // Build SQL query with filters
    let query = 'SELECT * FROM companies WHERE 1=1';
    const params = [];
    let paramCount = 0;

    if (search) {
      paramCount++;
      query += ` AND (company_name ILIKE $${paramCount} OR city ILIKE $${paramCount} OR industry ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    if (industry) {
      paramCount++;
      query += ` AND industry = $${paramCount}`;
      params.push(industry);
    }

    // Add pagination
    const offset = (page - 1) * limit;
    query += ` ORDER BY company_name LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    const companies = result.rows.map(company => ({
      name: company.company_name,
      tradestyle: company.tradestyle || '',
      address: company.address_line_1 || '',
      city: company.city || '',
      state: company.state || '',
      postalCode: company.postal_code || '',
      phone: company.phone || '',
      url: company.website || '',
      sales: company.revenue_formatted || '',
      employees: company.employees_total?.toString() || '',
      description: company.business_description || '',
      industry: company.industry || '',
      isHeadquarters: company.is_headquarters || false,
      ownership: company.ownership_type || '',
      entity_type: company.entity_type || '',
      revenue_numeric: company.revenue_numeric || 0,
      employeesSite: company.employees_single_site?.toString() || ''
    }));

    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) FROM companies WHERE 1=1';
    const countParams = [];
    let countParamCount = 0;

    if (search) {
      countParamCount++;
      countQuery += ` AND (company_name ILIKE $${countParamCount} OR city ILIKE $${countParamCount} OR industry ILIKE $${countParamCount})`;
      countParams.push(`%${search}%`);
    }

    if (industry) {
      countParamCount++;
      countQuery += ` AND industry = $${countParamCount}`;
      countParams.push(industry);
    }

    const countResult = await pool.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].count);

    res.json({
      companies,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      },
      filters: {
        search,
        industry
      }
    });
    
    // Apply industry filter
    if (industry) {
      filteredCompanies = filteredCompanies.filter(company => 
        company.industry.toLowerCase().includes(industry.toLowerCase())
      );
    }
    
    const total = filteredCompanies.length;
    const offset = (page - 1) * limit;
    const paginatedCompanies = filteredCompanies.slice(offset, offset + parseInt(limit));
    
    res.json({
      companies: paginatedCompanies,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      },
      filters: {
        search,
        industry
      }
    });

  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).json({ 
      error: 'Failed to fetch companies',
      message: error.message 
    });
  }
});

// Get single company by name
app.get('/api/companies/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const decodedName = decodeURIComponent(name);
    
    // Find company in real data
    const company = companiesData.find(c => c.name === decodedName);
    
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }
    
    res.json(company);

  } catch (error) {
    console.error('Error fetching company:', error);
    res.status(500).json({ 
      error: 'Failed to fetch company',
      message: error.message 
    });
  }
});

// Get unique industries for filter dropdown
app.get('/api/industries', async (req, res) => {
  try {
    // Return real industries
    res.json(industriesData);

  } catch (error) {
    console.error('Error fetching industries:', error);
    res.status(500).json({ 
      error: 'Failed to fetch industries',
      message: error.message 
    });
  }
});

// Get database statistics
app.get('/api/stats', async (req, res) => {
  try {
    // Calculate stats from real data
    const stats = {
      totalCompanies: companiesData.length,
      totalContacts: contactsData.length,
      totalIndustries: industriesData.length,
      headquartersCount: companiesData.filter(c => c.isHeadquarters).length,
      averageRevenue: companiesData.reduce((sum, c) => sum + (c.revenue_numeric || 0), 0) / companiesData.length,
      averageEmployees: companiesData.reduce((sum, c) => sum + (parseInt(c.employees) || 0), 0) / companiesData.length
    };

    res.json(stats);

  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch statistics',
      message: error.message 
    });
  }
});

// Test database connection
app.get('/api/db-test', async (req, res) => {
  try {
    // For now, return mock connection status
    res.json({
      status: 'csv_data_active',
      timestamp: new Date().toISOString(),
      message: 'Using real data from cleaned CSV files',
      companiesLoaded: companiesData.length,
      contactsLoaded: contactsData.length,
      industriesGenerated: industriesData.length
    });
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(500).json({ 
      error: 'Database connection failed',
      message: error.message 
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Initialize data and start server
async function startServer() {
  try {
    console.log('🚀 Starting JUST-WORK API Server...');
    console.log('=====================================');
    
    // Load data from CSV files
    await loadCompaniesData();
    await loadContactsData();
    generateIndustriesData();
    
    console.log('=====================================');
    
    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 JUST-WORK API server running on port ${PORT}`);
      console.log(`📊 Serving ${companiesData.length} real companies`);
      console.log(`👥 Loaded ${contactsData.length} contacts`);
      console.log(`🏭 Available industries: ${industriesData.length}`);
      console.log(`🌐 Health check: http://localhost:${PORT}/health`);
      console.log(`📊 API endpoints: http://localhost:${PORT}/api/companies`);
      console.log('=====================================');
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  await pool.end();
  process.exit(0);
});
