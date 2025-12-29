const http = require('http');
const proxy = require('../api/trials-proxy');

// Minimal mock request/response to call the proxy handler
function makeReq(path) {
  const req = new http.IncomingMessage();
  req.url = path;
  req.method = 'GET';
  req.headers = { 'user-agent': 'curl/1.0' };
  const res = new http.ServerResponse(req);
  res.assignSocket(require('net').createConnection(0));
  res.on('finish', () => process.exit(0));
  proxy(req, res).catch(err => { console.error('proxy error:', err); process.exit(1); });
}

// Example: search CTGov via proxy
const path = '/?source=ctgov&expr=cancer&fields=NCTId,BriefTitle';
makeReq(path);
