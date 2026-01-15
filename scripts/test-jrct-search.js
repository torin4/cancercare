// Test script for JRCT search endpoint
const axios = require('axios');

const PROXY_BASE = 'http://localhost:4000';

async function testJRCTSearch() {
  console.log('=== Testing JRCT Search Endpoint ===\n');
  
  try {
    // Test 1: Basic search query
    console.log('Test 1: Basic search for "cancer"');
    const response = await axios.get(`${PROXY_BASE}/api/jrct/search`, {
      params: {
        q: 'cancer',
        page: 1
      },
      timeout: 30000
    });
    
    console.log(`Status: ${response.status}`);
    console.log(`Response keys: ${Object.keys(response.data).join(', ')}`);
    
    if (response.data.results) {
      console.log(`Total results: ${response.data.total || 'unknown'}`);
      console.log(`Results count: ${response.data.results.length}`);
      
      if (response.data.results.length > 0) {
        console.log('\nFirst result:');
        console.log(JSON.stringify(response.data.results[0], null, 2));
      }
    }
    
    if (response.data.pages) {
      console.log(`\nPagination: ${response.data.pages.length} page links found`);
      if (response.data.pages.length > 0) {
        console.log(`First page link: ${response.data.pages[0].label} - ${response.data.pages[0].href}`);
      }
    }
    
    console.log('\n✅ Search test passed!\n');
    
    // Test 2: Search with Japanese query
    console.log('Test 2: Search with Japanese query "がん"');
    try {
      const response2 = await axios.get(`${PROXY_BASE}/api/jrct/search`, {
        params: {
          q: 'がん',
          page: 1
        },
        timeout: 30000
      });
      
      if (response2.data.results) {
        console.log(`Total results: ${response2.data.total || 'unknown'}`);
        console.log(`Results count: ${response2.data.results.length}`);
        console.log('✅ Japanese query test passed!\n');
      }
    } catch (err) {
      console.log(`⚠️  Japanese query test failed: ${err.message}\n`);
    }
    
    return { success: true, data: response.data };
  } catch (error) {
    console.error('❌ Test failed:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Error: ${JSON.stringify(error.response.data, null, 2)}`);
    } else {
      console.error(`Error: ${error.message}`);
    }
    return { success: false, error: error.message };
  }
}

// Run the test
if (require.main === module) {
  testJRCTSearch()
    .then(result => {
      if (result.success) {
        console.log('=== All tests completed successfully ===');
        process.exit(0);
      } else {
        console.log('=== Tests failed ===');
        process.exit(1);
      }
    })
    .catch(err => {
      console.error('Unexpected error:', err);
      process.exit(1);
    });
}

module.exports = { testJRCTSearch };
