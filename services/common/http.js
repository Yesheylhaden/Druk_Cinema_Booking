import express from 'express';
import pg from 'pg';
import {createHash,timingSafeEqual} from 'node:crypto';
const ports={movies:4001,bookings:4002,auth:4003,profiles:4004,cinemas:4005,showtimes:4006,halls:4007,seats:4008,reservations:4009,payments:4010,tickets:4011,notifications:4012,search:4013};
export const urlFor=name=>process.env[name.toUpperCase()+'_URL']||'http://localhost:'+ports[name];
export const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
export const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
export function failure(status,message,code){const error=new Error(message);error.status=status;error.code=code;return error;}
export async function call(name,path,{body,cookie,internal=false,method}={}){
 const headers={};if(body!==undefined)headers['Content-Type']='application/json';if(cookie)headers.Cookie=cookie;if(internal)headers['X-Service-Token']=process.env.SERVICE_TOKEN||'';
 const response=await fetch(urlFor(name)+path,{method:method||(body===undefined?'GET':'POST'),headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)}).catch(()=>{throw failure(503,name+' service is unavailable.');});
 const data=await response.json().catch(()=>({error:name+' service returned an invalid response.'}));
 if(!response.ok){const error=failure(response.status,data.error||'Request failed.',data.code);error.retryAfter=response.headers.get('Retry-After');throw error;}return data;
}
export function internalOnly(req,res,next){
 const expected=process.env.SERVICE_TOKEN,received=req.headers['x-service-token'];
 if(!expected)return res.status(503).json({error:'Internal service authentication is not configured.'});
 const hash=value=>createHash('sha256').update(value).digest();
 if(typeof received!=='string'||!timingSafeEqual(hash(expected),hash(received)))return res.status(403).json({error:'Service authentication required.'});
 next();
}
export function authenticate(withProfile=false){return wrap(async(req,res,next)=>{
 const account=await call('auth','/api/auth/me',{cookie:req.headers.cookie});
 req.account=account.user;
 if(withProfile){const profile=await call('profiles','/api/profiles/me',{cookie:req.headers.cookie});req.account=profile.user;}
 next();
});}
export async function notificationsReady(){try{return (await call('notifications','/api/notifications/capabilities')).available;}catch{return false;}}
export const notify=body=>call('notifications','/internal/notifications',{body,internal:true});
export function service(name,port=ports[name]){
 const app=express(),pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
 app.disable('x-powered-by');app.use(express.json({limit:'512kb'}));app.use((_req,res,next)=>{res.set('Cache-Control','no-store');next();});
 app.use((req,res,next)=>{if(req.method==='POST'&&(!req.is('application/json')||req.headers.origin&&!(process.env.FRONTEND_ORIGIN||'http://localhost:5173').split(',').includes(req.headers.origin)||req.headers['sec-fetch-site']==='cross-site'))return res.status(403).json({error:'Request origin or content type is not allowed.'});next();});
 app.get('/health',wrap(async(_req,res)=>{await pool.query('SELECT 1');res.json({status:'ok',service:name});}));
 function start(){app.use((error,_req,res,_next)=>{if(error.retryAfter)res.set('Retry-After',error.retryAfter);const status=error.status||(error.type==='entity.parse.failed'||error.code==='22P02'?400:503);if(status>=500)console.error(name+': '+(error.code||error.name));res.status(status).json({error:status>=500&&!error.status?name+' service unavailable.':error.message,code:error.code});});return app.listen(process.env.PORT||port,'0.0.0.0');}
 return {app,pool,start};
}

export function requireRole(...roles){return (req,res,next)=>{
 if(!req.account)return res.status(401).json({error:'Please sign in to continue.'});
 if(!roles.includes(req.account.role))return res.status(403).json({error:'You do not have permission to access this resource.'});
 next();
};}
