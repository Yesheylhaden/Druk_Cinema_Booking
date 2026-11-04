import pg from 'pg';
import {readFile} from 'node:fs/promises';
import {createAuthApp} from './app.js';
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
await pool.query(await readFile(new URL('./schema.sql',import.meta.url),'utf8'));
const app=await createAuthApp(pool,{origins:(process.env.FRONTEND_ORIGIN||'http://localhost:5173').split(','),secure:process.env.COOKIE_SECURE==='true'});
app.listen(process.env.PORT||4003,'0.0.0.0');
