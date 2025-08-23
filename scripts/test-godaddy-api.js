#!/usr/bin/env node

/**
 * GoDaddy API Test Script
 * Tests the connection and lists domains
 */

import axios from 'axios';

async function testGoDaddyAPI() {
  try {
    console.log('🚀 Testing GoDaddy API Connection...');
    console.log('');

    // API credentials
    const apiKey = 'gHKhkafh4D1G_4ntPnuc84hFA2W8bwtQ8KU';
    const apiSecret = '81sQWbJhgejgv4Dsmpf27Y';
    const baseURL = 'https://api.godaddy.com';

    // Create axios client
    const client = axios.create({
      baseURL,
      headers: {
        'Authorization': `sso-key ${apiKey}:${apiSecret}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 30000
    });

    // Test connection
    console.log('🔌 Testing API connection...');
    const response = await client.get('/v1/domains');
    
    if (response.status !== 200) {
      console.error('❌ Failed to connect to GoDaddy API');
      process.exit(1);
    }
    
    console.log('✅ Successfully connected to GoDaddy API');
    console.log('');

    // Get domains
    console.log('📋 Fetching domains...');
    const domains = response.data;
    
    console.log(`✅ Found ${domains.length} domain(s):`);
    console.log('');

    domains.forEach((domain, index) => {
      console.log(`${index + 1}. ${domain.domain}`);
      console.log(`   Status: ${domain.status}`);
      console.log(`   Expires: ${domain.expires}`);
      console.log(`   Auto-renew: ${domain.renewAuto ? 'Yes' : 'No'}`);
      console.log(`   Privacy: ${domain.privacy ? 'Enabled' : 'Disabled'}`);
      console.log(`   Locked: ${domain.locked ? 'Yes' : 'No'}`);
      console.log(`   Nameservers: ${domain.nameServers?.join(', ') || 'N/A'}`);
      console.log('');
    });

    // Test domain details for first domain if available
    if (domains.length > 0) {
      const firstDomain = domains[0].domain;
      console.log(`🔍 Getting detailed info for ${firstDomain}...`);
      
      try {
        const domainResponse = await client.get(`/v1/domains/${firstDomain}`);
        console.log('✅ Domain details retrieved successfully');
        
        // Get DNS records
        console.log(`📡 Getting DNS records for ${firstDomain}...`);
        const dnsResponse = await client.get(`/v1/domains/${firstDomain}/records`);
        const dnsRecords = dnsResponse.data;
        console.log(`✅ Found ${dnsRecords.length} DNS record(s):`);
        
        dnsRecords.slice(0, 10).forEach((record, index) => {
          console.log(`   ${index + 1}. ${record.type} ${record.name} -> ${record.data} (TTL: ${record.ttl || 'default'})`);
        });
        
        if (dnsRecords.length > 10) {
          console.log(`   ... and ${dnsRecords.length - 10} more records`);
        }
        
      } catch (error) {
        console.error(`❌ Failed to get details for ${firstDomain}:`, error.message);
      }
    }

    console.log('');
    console.log('🎉 GoDaddy API test completed successfully!');
    console.log('');
    console.log('📝 Available operations:');
    console.log('- Domain management');
    console.log('- DNS record management');
    console.log('- Domain availability checking');
    console.log('- Domain suggestions');
    console.log('- Nameserver management');
    console.log('- Domain forwarding');

  } catch (error) {
    console.error('❌ GoDaddy API test failed:', error.message);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    
    process.exit(1);
  }
}

// Run the test
testGoDaddyAPI().catch(console.error);
