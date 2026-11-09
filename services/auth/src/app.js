import {attachAccountSecurityRoutes} from './account-security.js';
import {call,requireRole} from '../../common/http.js';
import express from 'express';
import {randomBytes,randomUUID} from 'node:crypto';
import {normalizeEmail,validEmail,validPassword,digest,sessionToken,hashPassword,verifyPassword} from './security.js';

export async function createAuthApp(pool,{origins=['http://localhost:5173'],secure=false}={}){
 const app=express(),dummyHash=await hashPassword(randomBytes(32).toString('hex'));
 app.disable('x-powered-by');
 app.use(express.json({limit:'16kb'}));
 app.use((_req,res,next)=>{res.set('Cache-Control','no-store');next();});
 app.get('/health',async(_req,res)=>{try{await pool.query('SELECT 1');res.json({status:'ok',service:'auth'});}catch{res.status(503).json({error:'Database unavailable'});}});
 app.use('/api/auth',(req,res,next)=>{
  if(req.method==='POST'&&(!req.is('application/json')||req.headers.origin&&!origins.includes(req.headers.origin)||req.headers['sec-fetch-site']==='cross-site')){
   return res.status(403).json({error:'Request origin or content type is not allowed.'});
  }next();
 });
 const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
 const cookie=(res,token,maxAge=604800)=>res.setHeader('Set-Cookie','druk_session='+token+'; HttpOnly; SameSite=Lax; Path=/api; Max-Age='+maxAge+(secure?'; Secure':''));
 async function limit(req,res){
  // Both account and network limits persist across service restarts.
  const email=normalizeEmail(req.body?.email);
  for(const [key,max] of [['ip:'+req.ip,100],['email:'+email,20]]){
   const {rows}=await pool.query(`INSERT INTO identity.rate_limits(key,hits,resets_at) VALUES($1,1,NOW()+INTERVAL '15 minutes')
    ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN identity.rate_limits.resets_at<NOW() THEN 1 ELSE identity.rate_limits.hits+1 END,
    resets_at=CASE WHEN identity.rate_limits.resets_at<NOW() THEN NOW()+INTERVAL '15 minutes' ELSE identity.rate_limits.resets_at END RETURNING hits`,[digest(key)]);
   if(rows[0].hits>max){res.set('Retry-After','900');res.status(429).json({error:'Too many attempts. Please try again in 15 minutes.'});return false;}
  }return true;
 }
 async function issue(client,req,res,user,status){
  const old=sessionToken(req.headers.cookie),token=randomBytes(32).toString('hex');
  if(old)await client.query('DELETE FROM identity.sessions WHERE token_hash=$1',[digest(old)]);
  await client.query('INSERT INTO identity.sessions(token_hash,user_id,expires_at) VALUES($1,$2,NOW()+INTERVAL \'7 days\')',[digest(token),user.id]);
  return {token,user,status};
 }
 app.post('/api/auth/register',wrap(async(req,res)=>{
  if(!await limit(req,res))return;
  const {name,password}=req.body||{},email=normalizeEmail(req.body?.email);
  if(typeof name!=='string'||name.trim().length<2||name.trim().length>100||!validEmail(email)||!validPassword(password))return res.status(400).json({error:'Enter your name, a valid email, and a password of 8–128 characters.'});
  const passwordHash=await hashPassword(password);
  const client=await pool.connect();
  try{
   await client.query('BEGIN');
   const {rows}=await client.query('INSERT INTO identity.users(id,name,email,password_hash) VALUES($1,$2,$3,$4) RETURNING id,name,email,role',[randomUUID(),name.trim(),email,passwordHash]);
   const result=await issue(client,req,res,rows[0],201);
   await client.query('COMMIT');cookie(res,result.token);res.status(201).json({user:result.user});
  }catch(e){await client.query('ROLLBACK');if(e.code==='23505')return res.status(409).json({error:'An account with this email already exists. Please sign in.'});throw e;}finally{client.release();}
 }));
 app.post('/api/auth/login',wrap(async(req,res)=>{
  if(!await limit(req,res))return;
  const email=normalizeEmail(req.body?.email),password=req.body?.password;
  if(!validEmail(email)||typeof password!=='string'||password.length<1||password.length>128)return res.status(400).json({error:'Enter a valid email and password.'});
  const {rows}=await pool.query('SELECT id,name,email,role,password_hash,phone,email_verified AS "emailVerified",created_at AS "createdAt" FROM identity.users WHERE email=$1',[email]),user=rows[0];
  const matches=await verifyPassword(password,user?.password_hash||dummyHash);
  if(!user||!matches)return res.status(401).json({error:'Incorrect email or password.'});
  const client=await pool.connect();
  try{await client.query('BEGIN');const locked=(await client.query('SELECT password_hash,email,role FROM identity.users WHERE id=$1 FOR UPDATE',[user.id])).rows[0];if(!locked||locked.password_hash!==user.password_hash||locked.email!==user.email){await client.query('ROLLBACK');return res.status(401).json({error:'Account changed. Please log in again.'});}const {password_hash,...publicUser}=user;publicUser.role=locked.role;const result=await issue(client,req,res,publicUser,200);await client.query('COMMIT');cookie(res,result.token);res.json({user:publicUser});}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
 }));
 app.get('/api/auth/me',wrap(async(req,res)=>{
  const token=sessionToken(req.headers.cookie);
  if(!token)return res.status(401).json({error:'Please sign in to continue.'});
  const {rows}=await pool.query('SELECT u.id,u.name,u.email,u.role,u.phone,u.email_verified AS "emailVerified",u.created_at AS "createdAt" FROM identity.sessions s JOIN identity.users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>NOW()',[digest(token)]);
  if(!rows[0]){cookie(res,'',0);return res.status(401).json({error:'Your session has expired. Please sign in again.'});}
  res.json({user:rows[0]});
 }));
 // Resolve role from the database on every protected request; browser role values are never trusted.
 const adminSession=wrap(async(req,res,next)=>{
  const token=sessionToken(req.headers.cookie);
  const user=token?(await pool.query('SELECT u.id,u.role FROM identity.sessions s JOIN identity.users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>NOW()',[digest(token)])).rows[0]:null;
  if(!user)return res.status(401).json({error:'Please sign in to continue.'});
  req.account=user;next();
 });
 app.get('/api/auth/admin/users',adminSession,requireRole('admin'),wrap(async(req,res)=>{
  const page=Number(req.query.page||1);
  if(!Number.isSafeInteger(page)||page<1||page>100000)return res.status(400).json({error:'Invalid page.'});
  const result=await pool.query('SELECT id,name,email,role,email_verified AS "emailVerified",created_at AS "createdAt" FROM identity.users ORDER BY created_at DESC,id LIMIT 50 OFFSET $1',[(page-1)*50]);
  res.json({users:result.rows,page,hasMore:result.rows.length===50});
 }));
 app.post('/api/auth/logout',wrap(async(req,res)=>{
  const token=sessionToken(req.headers.cookie);if(token)await pool.query('DELETE FROM identity.sessions WHERE token_hash=$1',[digest(token)]);
  cookie(res,'',0);res.json({ok:true});
 }));
 app.get('/api/auth/profile',wrap(async(req,res)=>res.json(await call('profiles','/api/profiles/me',{cookie:req.headers.cookie}))));
 app.post('/api/auth/profile',wrap(async(req,res)=>res.json(await call('profiles','/api/profiles/me',{body:req.body,cookie:req.headers.cookie}))));
 attachAccountSecurityRoutes(app,pool,{wrap,cookie,issue,origin:origins[0]});
 app.use((error,_req,res,_next)=>{console.error(error.code||error.name);res.status(error.status||(error.type==='entity.parse.failed'?400:503)).json({error:error.status?error.message:error.type==='entity.parse.failed'?'Invalid request.':'Account service unavailable. Please try again.'});});
 return app;
}
