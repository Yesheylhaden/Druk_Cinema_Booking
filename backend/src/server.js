import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { createDataStore } from './services/data-store.js';

const dataFile = process.env.DATA_FILE || fileURLToPath(new URL('../data/druk-cinema.json', import.meta.url));
const store = await createDataStore(dataFile);
const server = createApp(store, { frontendOrigin: process.env.FRONTEND_ORIGIN });
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 3001);
server.listen(port, host, () => console.log(`Druk Cinema API: http://${host}:${port}/api/health`));
server.on('error', error => { console.error(error.message); process.exit(1); });
