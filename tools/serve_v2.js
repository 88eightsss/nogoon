const http = require('http');
const fs = require('fs');

const FILE = 'C:\\Users\\jtshi\\nogoon\\nogoon-v7.aab';
const LOG = 'C:\\Users\\jtshi\\nogoon\\server_v2.log';

function log(msg) {
  const line = new Date().toISOString() + ' ' + msg + '\n';
  process.stdout.write(line);
  try { fs.appendFileSync(LOG, line); } catch(e) {}
}

const server = http.createServer((req, res) => {
  log(req.method + ' ' + req.url);

  // CORS + Private Network Access headers (always set)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, HEAD');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization');

  if (req.method === 'OPTIONS' || req.method === 'HEAD') {
    res.writeHead(200);
    res.end();
    return;
  }

  const stats = fs.statSync(FILE);
  log('Sending file, size=' + stats.size);
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Length', stats.size);
  res.writeHead(200);
  const stream = fs.createReadStream(FILE);
  stream.pipe(res);
  stream.on('end', () => log('Done sending'));
  stream.on('error', (e) => log('Stream error: ' + e.message));
});

fs.writeFileSync(LOG, '');
server.listen(9999, '127.0.0.1', () => {
  log('Serving ' + FILE + ' on http://127.0.0.1:9999');
});

server.on('error', (err) => {
  log('Server error: ' + err.message);
});
