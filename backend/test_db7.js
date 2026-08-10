const http = require('https');

http.get('https://backend-lilac-xi-77.vercel.app/api/orders?storeId=21', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Response:', data));
}).on('error', err => console.log('Error:', err.message));
