const http = require('http');
const fs = require('fs');
const path = require('path');

const FILE = 'C:\\Users\\jtshi\\Downloads\\nogoon-v7.aab';

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Content-Type', 'application/octet-stream');
  fs.readFile(FILE, (err, data) => {
    if (err) { res.writeHead(500); res.end(err.message); return; }
    res.writeHead(200);
    res.end(data);
  });
});

server.listen(9999, '127.0.0.1', () => {
  console.log('Serving nogoon-v7.aab on http://127.0.0.1:9999');
});
