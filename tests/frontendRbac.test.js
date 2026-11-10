import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {loginDestination} from '../frontend/src/frontendAuth.js';
const exec=promisify(execFile);
test('login redirects follow the assigned role and preserve ticket/customer destinations',()=>{
 assert.equal(loginDestination({role:'admin'}),'/admin');assert.equal(loginDestination({role:'user'}),'/');
 assert.equal(loginDestination({role:'user'},'/admin'),'/');assert.equal(loginDestination({role:'admin'},'/bookings'),'/bookings');
 const path='/ticket/'+randomUUID();assert.equal(loginDestination({role:'user'},path),path);
 assert.equal(loginDestination({role:'user'},'https://evil.example'),'/');
});
test('RBAC prevents public privilege escalation and checks current roles on every admin request',{skip:process.env.RUN_INTEGRATION!=='1'},async()=>{
 const email='rbac-'+randomUUID()+'@example.com',password='RBAC integration password 2026!';let id;
 const run=query=>exec('docker',['compose','exec','-T','postgres','psql','-U','druk','-d','druk_cinema','-v','ON_ERROR_STOP=1','-c',query]);
 const auth=(path,body,cookie='')=>fetch('http://localhost:4003/api/auth/'+path,{method:body?'POST':'GET',headers:{Cookie:cookie,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 try{
  assert.equal((await auth('admin/users')).status,401);
  const response=await auth('register',{email,password,name:'RBAC Test',role:'admin'});assert.equal(response.status,201);
  const user=(await response.json()).user;id=user.id;assert.equal(user.role,'user');let cookie=response.headers.get('set-cookie').split(';')[0];
  assert.equal((await auth('admin/users',undefined,cookie)).status,403);
  assert.equal((await auth('me',undefined,cookie)).status,200);
  const login=await auth('login',{email,password,role:'admin'});assert.equal((await login.json()).user.role,'user');
  cookie=login.headers.get('set-cookie').split(';')[0];
  const profile=await fetch('http://localhost:4004/api/profiles/me',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({name:'General User',role:'admin'})});assert.equal(profile.status,200);assert.equal((await profile.json()).user.role,'user');
  assert.equal((await auth('admin/users',undefined,cookie)).status,403);
  await exec('docker',['compose','run','--rm','--no-deps','migrate','node','services/auth/scripts/set-role.js',email,'admin']);
  assert.equal((await auth('me',undefined,cookie)).status,401);
  const adminLogin=await auth('login',{email,password});assert.equal((await adminLogin.json()).user.role,'admin');cookie=adminLogin.headers.get('set-cookie').split(';')[0];
  const listing=await auth('admin/users',undefined,cookie);assert.equal(listing.status,200);const accounts=(await listing.json()).users;assert.ok(accounts.some(item=>item.id===id));assert.ok(accounts.every(item=>!('password_hash' in item)));
  assert.equal((await auth('me',undefined,cookie)).status,200);
  await run("UPDATE identity.users SET role='user' WHERE id='"+id+"'");
  assert.equal((await auth('admin/users',undefined,cookie)).status,403);assert.equal((await(await auth('me',undefined,cookie)).json()).user.role,'user');
 }finally{if(id)await run("DELETE FROM profiles.users WHERE user_id='"+id+"'; DELETE FROM identity.users WHERE id='"+id+"';");}
});
