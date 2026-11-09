import pg from 'pg';
import {normalizeEmail,validEmail} from '../src/security.js';
const [emailInput,role]=process.argv.slice(2),email=normalizeEmail(emailInput);
if(!validEmail(email)||!['admin','user'].includes(role)){console.error('Usage: node services/auth/scripts/set-role.js EMAIL admin|user');process.exit(1);}
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL}),client=await pool.connect();
try{
 await client.query('BEGIN');
 const result=await client.query('UPDATE identity.users SET role=$2,credential_version=credential_version+1 WHERE email=$1 RETURNING id',[email,role]);
 if(!result.rows.length)throw new Error('Account not found. Register the account first.');
 await client.query('DELETE FROM identity.sessions WHERE user_id=$1',[result.rows[0].id]);
 await client.query('DELETE FROM identity.action_tokens WHERE user_id=$1',[result.rows[0].id]);
 await client.query('COMMIT');console.log('Role updated to '+role+'. The account must log in again.');
}catch(error){await client.query('ROLLBACK');console.error(error.message);process.exitCode=1;}finally{client.release();await pool.end();}
