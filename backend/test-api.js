const axios = require('axios');

async function testAPI() {
  try {
    console.log('Testing check-username endpoint...');
    const response = await axios.post('http://localhost:5000/auth/check-username', {
      username: 'xusanboy'
    });
    console.log('✅ Response:', response.data);
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testAPI();
