// Serve the generated preview pages.
//
//   node tools/preview/build.mjs
//   node tools/preview/serve.mjs
//
// Then open http://127.0.0.1:8766/index.html (dark) or /light/index.html.
// PORT overrides the port (default 8766).

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(path.join(here, 'site'));
const port = Number(process.env.PORT || 8766);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript' };

if (!fs.existsSync(root)) {
  console.error('site/ not found. Run: node tools/preview/build.mjs');
  process.exit(1);
}

http.createServer((req, res) => {
  const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '');
  const file = path.resolve(path.join(root, rel === '' ? 'index.html' : rel));
  if (file !== root && !file.startsWith(root + path.sep)) {
    res.writeHead(403).end('forbidden');
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(port, '127.0.0.1', () => console.log(`preview on http://127.0.0.1:${port}`));
