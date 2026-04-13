const http = require('http');

// First, login to get token
const loginData = JSON.stringify({username:'admin', password:'password'});
const loginOptions = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(loginData)
  }
};

const loginReq = http.request(loginOptions, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    const loginResponse = JSON.parse(body);
    console.log('Login Status:', res.statusCode);
    console.log('Token:', loginResponse.token ? 'Received' : 'Failed');
    
    // Now test the registration log endpoint
    if (loginResponse.token) {
      const logOptions = {
        hostname: 'localhost',
        port: 5000,
        path: '/api/shops/log/registrations',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${loginResponse.token}`
        }
      };
      
      const logReq = http.request(logOptions, res => {
        let logBody = '';
        res.on('data', d => logBody += d);
        res.on('end', () => {
          console.log('Registration Log Status:', res.statusCode);
          console.log('Log Response:', logBody);
          process.exit(0);
        });
      });
      logReq.on('error', e => {
        console.error('Log Error:', e);
        process.exit(1);
      });
      logReq.end();
    }
  });
});

loginReq.on('error', e => {
  console.error('Login Error:', e);
  process.exit(1);
});

loginReq.write(loginData);
loginReq.end();
