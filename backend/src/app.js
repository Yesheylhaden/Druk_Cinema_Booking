import { createServer } from 'node:http';
import { routeApi } from './routes/api-routes.js';
import { sendJson } from './utils/http.js';

export function createApp(store, { frontendOrigin = 'http://localhost:3000' } = {}) {
  return createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    const allowed = [frontendOrigin, 'http://127.0.0.1:3000'];
    if (request.headers.origin && !allowed.includes(request.headers.origin)) {
      return sendJson(response, 403, { error: 'Origin is not allowed' });
    }
    if (request.headers.origin) {
      response.setHeader('Access-Control-Allow-Origin', request.headers.origin);
      response.setHeader('Vary', 'Origin');
    }
    if (request.method === 'OPTIONS') {
      response.writeHead(204, {
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
      return response.end();
    }
    try { await routeApi(request, response, store); }
    catch (error) {
      if (!error.status) console.error(error);
      sendJson(response, error.status ?? 500, { error: error.status ? error.message : 'An unexpected server error occurred' });
    }
  });
}
