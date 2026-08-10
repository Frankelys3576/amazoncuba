const http = require('http');

http.get('http://localhost:5001/api/orders?storeId=21', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Response:', data));
}).on('error', err => console.log('Error:', err.message));
