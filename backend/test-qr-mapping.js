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
    
    // Now test the QR mapping endpoint
    if (loginResponse.token) {
      const mapData = JSON.stringify({shop_id: 1, qr_identifier: 'QR-ABC-123-XYZ'});
      const mapOptions = {
        hostname: 'localhost',
        port: 5000,
        path: '/api/shops/map-qr',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${loginResponse.token}`,
          'Content-Length': Buffer.byteLength(mapData)
        }
      };
      
      const mapReq = http.request(mapOptions, res => {
        let mapBody = '';
        res.on('data', d => mapBody += d);
        res.on('end', () => {
          console.log('QR Mapping Status:', res.statusCode);
          console.log('Response:', mapBody);
          process.exit(0);
        });
      });
      mapReq.on('error', e => {
        console.error('Mapping Error:', e);
        process.exit(1);
      });
      mapReq.write(mapData);
      mapReq.end();
    }
  });
});

loginReq.on('error', e => {
  console.error('Login Error:', e);
  process.exit(1);
});

loginReq.write(loginData);
loginReq.end();
