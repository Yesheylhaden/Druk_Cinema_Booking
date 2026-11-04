import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile),base=process.env.AUTH_TEST_URL||'http://localhost:4003';
const sql=q=>exec('docker',['compose','exec','-T','postgres','psql','-U','druk','-d','druk_cinema','-v','ON_ERROR_STOP=1','-c',q]);
test('profile, password changes, one-time verification, recovery, and email changes',{skip:process.env.RUN_INTEGRATION!=='1'},async(t)=>{
 const email='profile-'+randomUUID()+'@example.com',newEmail='changed-'+randomUUID()+'@example.com',password='Initial test password 2026!';
 let cookie='',id;
 const request=(path,body,session=cookie)=>fetch(base+'/api/auth/'+path,{method:body?'POST':'GET',headers:{Cookie:session,Origin:'http://localhost:5173','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 const registered=await request('register',{name:'Profile Test',email,password});assert.equal(registered.status,201);id=(await registered.json()).user.id;assert.match(id,/^[a-f0-9-]{36}$/);cookie=registered.headers.get('set-cookie').split(';')[0];
 async function seed(purpose,target=email,expired=false){
  const token=randomBytes(32).toString('hex'),hash=createHash('sha256').update(token).digest('hex');
  await sql("INSERT INTO identity.action_tokens(token_hash,user_id,purpose,email,credential_version,expires_at) SELECT '"+hash+"',id,'"+purpose+"','"+target+"',credential_version,NOW() "+(expired?"-":"+")+" INTERVAL '1 hour' FROM identity.users WHERE id='"+id+"';");
  return token;
 }
 try{
  const initial=await(await request('profile')).json();assert.equal(initial.user.emailVerified,false);assert.equal(initial.user.password_hash,undefined);
  assert.equal((await request('profile',undefined,'')).status,401);
  let response=await request('profile',{name:'Updated Pema',phone:'+975 17123456',email:'ignored@example.com'});assert.equal(response.status,200);let user=(await response.json()).user;assert.equal(user.name,'Updated Pema');assert.equal(user.phone,'+975 17123456');assert.equal(user.email,email);
  assert.equal((await request('profile',{name:'X',phone:'bad'})).status,400);
  if(!initial.emailAvailable){assert.equal((await request('verification/request',{})).status,503);assert.equal((await request('password/forgot',{email})).status,503);assert.equal((await request('email/change',{email:newEmail,currentPassword:password})).status,503);}
  const second=await request('login',{email,password},'');assert.equal(second.status,200);const secondCookie=second.headers.get('set-cookie').split(';')[0];
  assert.equal((await request('password',{currentPassword:'wrong',newPassword:'New password 2026!'})).status,400);
  response=await request('password',{currentPassword:password,newPassword:'New password 2026!'});assert.equal(response.status,200);const oldCookie=cookie;cookie=response.headers.get('set-cookie').split(';')[0];
  assert.equal((await request('me',undefined,oldCookie)).status,401);assert.equal((await request('me',undefined,secondCookie)).status,401);assert.equal((await request('me')).status,200);
  assert.equal((await request('login',{email,password},'')).status,401);
  const verification=await seed('verify');
  assert.equal((await request('password/reset',{token:verification,newPassword:'Wrong purpose password'})).status,400);
  const verifications=await Promise.all([request('verification/confirm',{token:verification}),request('verification/confirm',{token:verification})]);assert.deepEqual(verifications.map(r=>r.status).sort(),[200,400]);
  assert.equal((await(await request('profile')).json()).user.emailVerified,true);
  const expired=await seed('reset',email,true);
  assert.equal((await request('password/reset',{token:expired,newPassword:'Should not apply 2026!'})).status,400);
  // Seeded links test token consumption without sending external test mail.
  if(initial.emailAvailable){t.diagnostic('Skipping reset consumption with live SMTP configured to avoid sending test notices.');return;}
  const reset=await seed('reset');
  assert.equal((await request('password/reset',{token:reset,newPassword:'Recovered password 2026!'})).status,200);
  assert.equal((await request('me')).status,401);
  assert.equal((await request('password/reset',{token:reset,newPassword:'Replay password 2026!'})).status,400);
  response=await request('login',{email,password:'Recovered password 2026!'},'');assert.equal(response.status,200);cookie=response.headers.get('set-cookie').split(';')[0];
  const change=await seed('change-email',newEmail);
  response=await request('verification/confirm',{token:change});assert.equal(response.status,200);assert.equal((await response.json()).loginRequired,true);
  assert.equal((await request('me')).status,401);
  assert.equal((await request('login',{email,password:'Recovered password 2026!'},'')).status,401);
  response=await request('login',{email:newEmail,password:'Recovered password 2026!'},'');assert.equal(response.status,200);user=(await response.json()).user;assert.equal(user.email,newEmail);assert.equal(user.emailVerified,true);
 }finally{await sql("DELETE FROM identity.users WHERE id='"+id+"';");}
});
