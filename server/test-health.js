import http from 'http';
http.get('http://localhost:8080/__healthcheck', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Healthcheck returned:', res.statusCode, data));
}).on('error', err => console.log('Error:', err.message));
