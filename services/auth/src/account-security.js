import {randomBytes} from 'node:crypto';
import {normalizeEmail,validEmail,validPassword,digest,sessionToken,hashPassword,verifyPassword} from './security.js';
import {mailReady,accountMail,accountLink} from './mail.js';
const publicUser=user=>({id:user.id,name:user.name,email:user.email,role:user.role,phone:user.phone,emailVerified:user.email_verified,createdAt:user.created_at});
export function attachAccountSecurityRoutes(app,pool,{wrap,cookie,issue,origin}){
 async function current(req,res){
  const token=sessionToken(req.headers.cookie);
  const user=token?(await pool.query('SELECT u.* FROM identity.sessions s JOIN identity.users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>NOW()',[digest(token)])).rows[0]:null;
  if(!user)res.status(401).json({error:'Your session has expired. Please log in again.'});
  return user;
 }
 async function throttle(req,res,scope,identity){
  for(const [key,max] of [['action:'+scope+':ip:'+req.ip,50],['action:'+scope+':account:'+identity,5]]){
   const {rows}=await pool.query(`INSERT INTO identity.rate_limits(key,hits,resets_at) VALUES($1,1,NOW()+INTERVAL '15 minutes') ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN identity.rate_limits.resets_at<NOW() THEN 1 ELSE identity.rate_limits.hits+1 END,resets_at=CASE WHEN identity.rate_limits.resets_at<NOW() THEN NOW()+INTERVAL '15 minutes' ELSE identity.rate_limits.resets_at END RETURNING hits`,[digest(key)]);
   if(rows[0].hits>max){res.set('Retry-After','900');res.status(429).json({error:'Too many requests. Please try again in 15 minutes.'});return false;}
  }return true;
 }
 async function sendLink(user,purpose,email){
  const client=await pool.connect();let token;
  try{
   await client.query('BEGIN');
   const locked=(await client.query('SELECT * FROM identity.users WHERE id=$1 FOR UPDATE',[user.id])).rows[0];
   if(!locked||locked.credential_version!==user.credential_version){await client.query('ROLLBACK');return;}
   const recent=(await client.query("SELECT 1 FROM identity.action_tokens WHERE user_id=$1 AND purpose=$2 AND created_at>NOW()-INTERVAL '1 minute'",[user.id,purpose])).rows.length;
   if(recent){await client.query('ROLLBACK');return;}
   token=randomBytes(32).toString('hex');
   await client.query('DELETE FROM identity.action_tokens WHERE user_id=$1 AND purpose=$2',[user.id,purpose]);
   await client.query("INSERT INTO identity.action_tokens(token_hash,user_id,purpose,email,credential_version,expires_at) VALUES($1,$2,$3,$4,$5,NOW()+INTERVAL '1 hour')",[digest(token),user.id,purpose,email,user.credential_version]);
   await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  const reset=purpose==='reset',link=accountLink(origin,reset?'reset-password':'verify-email',token);
  await accountMail(email,reset?'Reset your Druk Cinema password':'Verify your Druk Cinema email',(reset?'Choose a new password':'Confirm your email address')+' using this one-time link (expires in 1 hour):\n'+link+'\nIf you did not request this, ignore this email. No changes occur until the link is confirmed.');
 }
 app.post('/api/auth/password',wrap(async(req,res)=>{
  const user=await current(req,res);if(!user||!await throttle(req,res,'password',user.id))return;
  const {currentPassword,newPassword}=req.body||{};
  if(typeof currentPassword!=='string'||currentPassword.length>128||!validPassword(newPassword))return res.status(400).json({error:'Enter your current password and a new password of 8–128 characters.'});
  const client=await pool.connect();
  try{
   await client.query('BEGIN');const row=(await client.query('SELECT * FROM identity.users WHERE id=$1 FOR UPDATE',[user.id])).rows[0];
   if(!await verifyPassword(currentPassword,row.password_hash)){await client.query('ROLLBACK');return res.status(400).json({error:'Current password is incorrect.'});}
   if(currentPassword===newPassword){await client.query('ROLLBACK');return res.status(400).json({error:'Choose a password different from your current password.'});}
   await client.query('UPDATE identity.users SET password_hash=$2,credential_version=credential_version+1 WHERE id=$1',[row.id,await hashPassword(newPassword)]);
   await client.query('DELETE FROM identity.action_tokens WHERE user_id=$1',[row.id]);
   await client.query('DELETE FROM identity.sessions WHERE user_id=$1',[row.id]);
   const session=await issue(client,req,res,publicUser(row),200);await client.query('COMMIT');cookie(res,session.token);
   res.json({user:publicUser(row),message:'Password changed. All other sessions have been signed out.'});
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 }));
 app.post('/api/auth/verification/request',wrap(async(req,res)=>{
  const user=await current(req,res);if(!user||!await throttle(req,res,'verify',user.id))return;
  if(user.email_verified)return res.json({message:'Your email is already verified.'});
  if(!await mailReady())return res.status(503).json({error:'Email delivery is not configured. Verification cannot be sent yet.'});
  await sendLink(user,'verify',user.email);res.json({message:'A verification link was requested. Check your inbox, or wait a minute before requesting another.'});
 }));
 app.post('/api/auth/email/change',wrap(async(req,res)=>{
  const user=await current(req,res);if(!user||!await throttle(req,res,'email',user.id))return;
  const email=normalizeEmail(req.body?.email),password=req.body?.currentPassword;
  if(!validEmail(email)||email===user.email||typeof password!=='string'||password.length>128)return res.status(400).json({error:'Enter a different valid email and your current password.'});
  if(!await verifyPassword(password,user.password_hash))return res.status(400).json({error:'Current password is incorrect.'});
  if(!await mailReady())return res.status(503).json({error:'Email delivery is not configured. Your current email has not changed.'});
  if((await pool.query('SELECT 1 FROM identity.users WHERE email=$1',[email])).rows.length)return res.status(409).json({error:'This email is already in use.'});
  await sendLink(user,'change-email',email);res.json({message:'Check the new email address to confirm the change. Your current login email remains active until then.'});
 }));
 app.post('/api/auth/password/forgot',wrap(async(req,res)=>{
  const email=normalizeEmail(req.body?.email);
  if(!validEmail(email))return res.status(400).json({error:'Enter a valid email address.'});
  if(!await throttle(req,res,'forgot',email))return;
  if(!await mailReady())return res.status(503).json({error:'Email delivery is not configured. Password reset links cannot be sent yet.'});
  const user=(await pool.query('SELECT * FROM identity.users WHERE email=$1',[email])).rows[0];
  res.status(202).json({message:'If an account exists for this email, a reset link will be sent. Check your inbox and spam folder.'});
  if(user)void sendLink(user,'reset',user.email).catch(()=>console.error('Account recovery email could not be delivered'));
 }));
 async function consume(req,res,purpose){
  const token=req.body?.token;
  if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token)){res.status(400).json({error:'This link is invalid or expired. Request a new one.'});return null;}
  if(!await throttle(req,res,'consume',digest(token)))return null;
  const hint=(await pool.query('SELECT user_id FROM identity.action_tokens WHERE token_hash=$1',[digest(token)])).rows[0];
  if(!hint){res.status(400).json({error:'This link is invalid or expired. Request a new one.'});return null;}
  const client=await pool.connect();
  try{
   await client.query('BEGIN');
   const user=(await client.query('SELECT * FROM identity.users WHERE id=$1 FOR UPDATE',[hint.user_id])).rows[0];
   const row=(await client.query('SELECT * FROM identity.action_tokens WHERE token_hash=$1 FOR UPDATE',[digest(token)])).rows[0];
   if(!user||!row||!purpose.includes(row.purpose)||new Date(row.expires_at)<=new Date()||row.credential_version!==user.credential_version||row.purpose!=='change-email'&&row.email!==user.email){await client.query('ROLLBACK');client.release();res.status(400).json({error:'This link is invalid or expired. Request a new one.'});return null;}
   return {client,user,row};
  }catch(error){await client.query('ROLLBACK');client.release();throw error;}
 }
 app.post('/api/auth/verification/confirm',wrap(async(req,res)=>{
  const result=await consume(req,res,['verify','change-email']);if(!result)return;
  const {client,user,row}=result;
  try{
   if(row.purpose==='change-email'){
    await client.query('UPDATE identity.users SET email=$2,email_verified=true,credential_version=credential_version+1 WHERE id=$1',[user.id,row.email]);
    await client.query('DELETE FROM identity.sessions WHERE user_id=$1',[user.id]);
    await client.query('DELETE FROM identity.action_tokens WHERE user_id=$1',[user.id]);
   }else{
    await client.query('UPDATE identity.users SET email_verified=true WHERE id=$1',[user.id]);
    await client.query('DELETE FROM identity.action_tokens WHERE token_hash=$1',[row.token_hash]);
   }
   await client.query('COMMIT');if(row.purpose==='change-email')cookie(res,'',0);
   res.json({message:row.purpose==='change-email'?'Email changed and verified. Log in with your new email.':'Email verified successfully.',loginRequired:row.purpose==='change-email'});
  }catch(error){await client.query('ROLLBACK');if(error.code==='23505')return res.status(409).json({error:'This email is already in use. Request another email change.'});throw error;}finally{client.release();}
 }));
 app.post('/api/auth/password/reset',wrap(async(req,res)=>{
  if(!validPassword(req.body?.newPassword))return res.status(400).json({error:'Use a password of 8–128 characters.'});
  const result=await consume(req,res,['reset']);if(!result)return;
  const {client,user}=result;
  try{
   await client.query('UPDATE identity.users SET password_hash=$2,credential_version=credential_version+1 WHERE id=$1',[user.id,await hashPassword(req.body.newPassword)]);
   await client.query('DELETE FROM identity.action_tokens WHERE user_id=$1',[user.id]);await client.query('DELETE FROM identity.sessions WHERE user_id=$1',[user.id]);
   await client.query('COMMIT');cookie(res,'',0);res.json({message:'Password reset. All sessions are signed out. Log in with your new password.'});
   if(await mailReady())void accountMail(user.email,'Your Druk Cinema password was reset','Your password was reset and all sessions were signed out. If this was not you, contact the cinema immediately.').catch(()=>console.error('Password reset notice could not be delivered'));
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 }));
}
