import pg from 'pg';
import {createAuthApp} from './app.js';
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
const app=await createAuthApp(pool,{origins:(process.env.FRONTEND_ORIGIN||'http://localhost:5173').split(','),secure:process.env.COOKIE_SECURE==='true'});
app.listen(process.env.PORT||4003,'0.0.0.0');
