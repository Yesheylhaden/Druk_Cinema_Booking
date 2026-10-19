import { cp, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
await mkdir(`${root}dist`, { recursive: true });
await cp(`${root}frontend/index.html`, `${root}dist/index.html`);
await cp(`${root}frontend/assets`, `${root}dist/assets`, { recursive: true });
console.log('Frontend copied to dist/. Deploy the backend separately and configure api.js first.');
