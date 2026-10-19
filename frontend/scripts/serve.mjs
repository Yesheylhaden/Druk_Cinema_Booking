import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, sep, extname } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png' };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!file.startsWith(root + (root.endsWith(sep) ? '' : sep)) || (file !== resolve(root, 'index.html') && !file.startsWith(resolve(root, 'assets') + sep))) {
      response.writeHead(404); return response.end('Not found');
    }
    const contents = await readFile(file);
    response.writeHead(200, { 'Content-Type': `${types[extname(file)] || 'application/octet-stream'}; charset=utf-8` });
    response.end(contents);
  } catch { if (!response.headersSent) response.writeHead(404); response.end('Not found'); }
});
server.listen(3000, '127.0.0.1', () => console.log('Druk Cinema dashboard: http://localhost:3000'));
server.on('error', error => { console.error(error.message); process.exit(1); });
