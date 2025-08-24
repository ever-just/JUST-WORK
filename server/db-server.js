#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import pg from 'pg';

const { Pool } = pg;
const app = express();
const PORT = process.env.PORT || 3001;

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

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*) FROM companies');
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      companies: result.rows[0].count
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// Get companies with pagination and filtering
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

  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).json({ error: 'Failed to fetch companies' });
  }
});

// Get available industries
app.get('/api/industries', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT industry 
      FROM companies 
      WHERE industry IS NOT NULL AND industry != '' 
      ORDER BY industry
    `);
    
    const industries = result.rows.map(row => ({
      value: row.industry,
      label: row.industry
    }));
    
    res.json(industries);
  } catch (error) {
    console.error('Error fetching industries:', error);
    res.status(500).json({ error: 'Failed to fetch industries' });
  }
});

// Get contacts for a specific company
app.get('/api/companies/:companyName/contacts', async (req, res) => {
  try {
    const companyName = decodeURIComponent(req.params.companyName);
    
    const result = await pool.query(`
      SELECT c.first_name, c.last_name, c.title, c.email_flag, c.phone_flag
      FROM contacts c
      JOIN companies comp ON c.duns_number = comp.duns_number
      WHERE comp.company_name = $1
      ORDER BY c.last_name, c.first_name
    `, [companyName]);
    
    const contacts = result.rows.map(contact => ({
      firstName: contact.first_name,
      lastName: contact.last_name,
      title: contact.title,
      hasEmail: contact.email_flag === 'Y',
      hasPhone: contact.phone_flag === 'Y'
    }));
    
    res.json({
      companyName,
      contacts,
      totalContacts: contacts.length
    });
    
  } catch (error) {
    console.error('Error fetching company contacts:', error);
    res.status(500).json({ error: 'Failed to fetch company contacts' });
  }
});

// Get statistics
app.get('/api/stats', async (req, res) => {
  try {
    const companiesResult = await pool.query('SELECT COUNT(*) FROM companies');
    const contactsResult = await pool.query('SELECT COUNT(*) FROM contacts');
    const industriesResult = await pool.query('SELECT COUNT(DISTINCT industry) FROM companies WHERE industry IS NOT NULL');
    const hqResult = await pool.query('SELECT COUNT(*) FROM companies WHERE is_headquarters = true');
    
    const avgRevenueResult = await pool.query('SELECT AVG(revenue_numeric) FROM companies WHERE revenue_numeric > 0');
    const avgEmployeesResult = await pool.query('SELECT AVG(employees_total) FROM companies WHERE employees_total > 0');

    const stats = {
      totalCompanies: parseInt(companiesResult.rows[0].count),
      totalContacts: parseInt(contactsResult.rows[0].count),
      totalIndustries: parseInt(industriesResult.rows[0].count),
      headquartersCount: parseInt(hqResult.rows[0].count),
      averageRevenue: parseFloat(avgRevenueResult.rows[0].avg) || 0,
      averageEmployees: parseFloat(avgEmployeesResult.rows[0].avg) || 0
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Database test endpoint
app.get('/api/db-test', async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*) FROM companies');
    res.json({
      status: 'database_connected',
      timestamp: new Date().toISOString(),
      companiesCount: result.rows[0].count,
      message: 'Successfully connected to DigitalOcean PostgreSQL database'
    });
  } catch (error) {
    res.status(500).json({
      status: 'database_error',
      error: error.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log('🚀 JUST-WORK Database API Server');
  console.log('=====================================');
  console.log(`🌐 Server running on port ${PORT}`);
  console.log(`🗄️  Database: ${dbConfig.database}@${dbConfig.host}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`📊 API endpoints: http://localhost:${PORT}/api/companies`);
  console.log('=====================================');
});
