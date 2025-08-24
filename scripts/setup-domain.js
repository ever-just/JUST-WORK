#!/usr/bin/env node

/**
 * GoDaddy Domain Setup Script
 * Configures just-work.app domain DNS records for JUST-WORK project
 */

import axios from 'axios';

// GoDaddy API Configuration
const API_KEY = 'gHKhkafh4D1G_4ntPnuc84hFA2W8bwtQ8KU';
const API_SECRET = '81sQWbJhgejgv4Dsmpf27Y';
const BASE_URL = 'https://api.godaddy.com';
const DOMAIN = 'just-work.app';

// Create axios client
const client = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Authorization': `sso-key ${API_KEY}:${API_SECRET}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  timeout: 30000
});

async function setupDomain() {
  try {
    console.log('🚀 Setting up just-work.app domain for JUST-WORK project...');
    console.log('');

    // First, let's check current DNS records
    console.log('🔍 Checking current DNS configuration...');
    const currentRecords = await client.get(`/v1/domains/${DOMAIN}/records`);
    console.log(`✅ Found ${currentRecords.data.length} existing DNS records`);
    
    // Show current A records
    const aRecords = currentRecords.data.filter(record => record.type === 'A');
    console.log('📋 Current A records:');
    aRecords.forEach(record => {
      console.log(`   ${record.name} -> ${record.data} (TTL: ${record.ttl})`);
    });
    console.log('');

    // Ask user for server IP
    console.log('🌐 To complete domain setup, I need your server IP address.');
    console.log('');
    console.log('Options:');
    console.log('1. If you have a DigitalOcean droplet, get the IP from: doctl compute droplet list');
    console.log('2. If using another hosting provider, check your server dashboard');
    console.log('3. For local development, you can use a service like ngrok');
    console.log('');
    
    // For now, let's prepare the DNS records structure
    const newDNSRecords = [
      {
        type: 'A',
        name: '@',
        data: 'YOUR_SERVER_IP_HERE', // This will be replaced with actual IP
        ttl: 600
      },
      {
        type: 'A',
        name: 'www',
        data: 'YOUR_SERVER_IP_HERE', // This will be replaced with actual IP
        ttl: 600
      },
      {
        type: 'CNAME',
        name: 'api',
        data: 'just-work.app',
        ttl: 600
      }
    ];

    console.log('📝 Prepared DNS configuration:');
    newDNSRecords.forEach(record => {
      console.log(`   ${record.type} ${record.name} -> ${record.data} (TTL: ${record.ttl})`);
    });
    console.log('');

    console.log('⚠️  To complete the setup, please provide your server IP address.');
    console.log('   Then run: node scripts/setup-domain.js --ip YOUR_SERVER_IP');
    console.log('');

    // Check if IP was provided as argument
    const ipArg = process.argv.find(arg => arg.startsWith('--ip='));
    if (ipArg) {
      const serverIP = ipArg.split('=')[1];
      await configureDNS(serverIP);
    } else {
      console.log('💡 Example usage:');
      console.log('   node scripts/setup-domain.js --ip=192.168.1.100');
      console.log('');
      console.log('🔧 Additional setup options:');
      console.log('   --subdomain=api    # Add API subdomain');
      console.log('   --ssl             # Show SSL setup instructions');
      console.log('   --verify          # Verify current DNS configuration');
    }

  } catch (error) {
    console.error('❌ Domain setup failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    process.exit(1);
  }
}

async function configureDNS(serverIP) {
  try {
    console.log(`🔧 Configuring DNS records for ${DOMAIN}...`);
    console.log(`📍 Server IP: ${serverIP}`);
    console.log('');

    // Validate IP address format
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipRegex.test(serverIP)) {
      throw new Error('Invalid IP address format');
    }

    // Prepare DNS records with actual IP
    const dnsRecords = [
      {
        type: 'A',
        name: '@',
        data: serverIP,
        ttl: 600
      },
      {
        type: 'A',
        name: 'www',
        data: serverIP,
        ttl: 600
      }
    ];

    // Add API subdomain if requested
    if (process.argv.includes('--subdomain=api')) {
      dnsRecords.push({
        type: 'A',
        name: 'api',
        data: serverIP,
        ttl: 600
      });
    }

    console.log('🚀 Updating DNS records...');
    
    // Update A records
    for (const record of dnsRecords) {
      console.log(`   Setting ${record.type} ${record.name} -> ${record.data}`);
      
      try {
        await client.put(`/v1/domains/${DOMAIN}/records/${record.type}/${record.name}`, [
          {
            data: record.data,
            ttl: record.ttl
          }
        ]);
        console.log(`   ✅ ${record.type} ${record.name} updated successfully`);
      } catch (recordError) {
        console.error(`   ❌ Failed to update ${record.type} ${record.name}:`, recordError.message);
      }
    }

    console.log('');
    console.log('🎉 DNS configuration completed!');
    console.log('');
    console.log('📋 Summary:');
    console.log(`   Domain: ${DOMAIN}`);
    console.log(`   Server IP: ${serverIP}`);
    console.log(`   Records updated: ${dnsRecords.length}`);
    console.log('');
    console.log('⏰ DNS propagation may take 5-30 minutes to complete worldwide.');
    console.log('');
    console.log('🔍 Verify setup:');
    console.log(`   dig ${DOMAIN}`);
    console.log(`   nslookup ${DOMAIN}`);
    console.log(`   curl -I http://${DOMAIN}`);
    console.log('');

    if (process.argv.includes('--ssl')) {
      showSSLInstructions();
    }

  } catch (error) {
    console.error('❌ DNS configuration failed:', error.message);
    throw error;
  }
}

function showSSLInstructions() {
  console.log('🔒 SSL/HTTPS Setup Instructions:');
  console.log('');
  console.log('1. Using Let\'s Encrypt (Recommended):');
  console.log('   sudo apt install certbot');
  console.log(`   sudo certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}`);
  console.log('');
  console.log('2. Using Cloudflare (Alternative):');
  console.log('   - Sign up for Cloudflare');
  console.log('   - Add your domain');
  console.log('   - Update nameservers to Cloudflare');
  console.log('   - Enable SSL in Cloudflare dashboard');
  console.log('');
  console.log('3. Manual SSL Certificate:');
  console.log('   - Purchase SSL certificate from GoDaddy or other provider');
  console.log('   - Install certificate on your server');
  console.log('   - Configure web server (Nginx/Apache) for HTTPS');
  console.log('');
}

async function verifyDNS() {
  try {
    console.log(`🔍 Verifying DNS configuration for ${DOMAIN}...`);
    console.log('');

    const records = await client.get(`/v1/domains/${DOMAIN}/records`);
    const aRecords = records.data.filter(record => record.type === 'A');
    const cnameRecords = records.data.filter(record => record.type === 'CNAME');

    console.log('📋 Current A Records:');
    aRecords.forEach(record => {
      console.log(`   ${record.name} -> ${record.data} (TTL: ${record.ttl})`);
    });

    console.log('');
    console.log('📋 Current CNAME Records:');
    cnameRecords.forEach(record => {
      console.log(`   ${record.name} -> ${record.data} (TTL: ${record.ttl})`);
    });

    console.log('');
    console.log('✅ DNS verification completed');

  } catch (error) {
    console.error('❌ DNS verification failed:', error.message);
  }
}

// Handle command line arguments
if (process.argv.includes('--verify')) {
  verifyDNS();
} else if (process.argv.includes('--ssl')) {
  showSSLInstructions();
} else {
  setupDomain();
}