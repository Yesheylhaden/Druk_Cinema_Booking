import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../services/gateway/src/worker.js';
const env={FRONTEND_ORIGIN:'https://cinema.example',CATALOG_URL:'https://catalog.example',BOOKINGS_URL:'https://bookings.example'};
test('rejects unexpected browser origins',async()=>{const r=await worker.fetch(new Request('https://gateway.example/api/movies',{headers:{Origin:'https://other.example'}}),env);assert.equal(r.status,403);});
test('handles preflight for the frontend',async()=>{const r=await worker.fetch(new Request('https://gateway.example/api/bookings',{method:'OPTIONS',headers:{Origin:env.FRONTEND_ORIGIN}}),env);assert.equal(r.status,204);assert.equal(r.headers.get('Access-Control-Allow-Origin'),env.FRONTEND_ORIGIN);});
test('limits exposed routes and methods',async()=>{assert.equal((await worker.fetch(new Request('https://gateway.example/admin'),env)).status,404);assert.equal((await worker.fetch(new Request('https://gateway.example/api/movies',{method:'DELETE'}),env)).status,405);});
test('routes movie and booking requests to their services',async()=>{const original=globalThis.fetch;const seen=[];globalThis.fetch=async(url,options)=>{seen.push({url:String(url),method:options.method});return Response.json({ok:true});};try{for(const path of ['/api/movies','/api/showtimes?movieId=1','/api/bookings/seats?showtimeId=2']){const r=await worker.fetch(new Request('https://gateway.example'+path),env);assert.equal(r.status,200);assert.equal(r.headers.get('Cache-Control'),'no-store');}assert.equal(seen[0].url,'https://catalog.example/api/movies');assert.equal(seen[2].url,'https://bookings.example/api/bookings/seats?showtimeId=2');}finally{globalThis.fetch=original;}});

test('gateway forwards session cookies and preserves login cookies',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async(url,options)=>{
  assert.equal(String(url),'https://auth.example/api/auth/login');
  assert.equal(options.headers.get('Cookie'),'druk_session=old');
  assert.equal(options.headers.get('Origin'),env.FRONTEND_ORIGIN);
  return Response.json({user:{id:'test'}},{headers:{'Set-Cookie':'druk_session=new; HttpOnly; SameSite=Lax; Path=/api'}});
 };
 try{
  const response=await worker.fetch(new Request('https://gateway.example/api/auth/login',{method:'POST',headers:{Origin:env.FRONTEND_ORIGIN,Cookie:'druk_session=old','Content-Type':'application/json'},body:'{}'}),{...env,AUTH_URL:'https://auth.example'});
  assert.equal(response.status,200);
  assert.equal(response.headers.get('Access-Control-Allow-Credentials'),'true');
  assert.match(response.headers.get('Set-Cookie'),/druk_session=new/);
 }finally{globalThis.fetch=original;}
});
test('booking management routes preserve PDF responses and reject wrong methods',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async()=>new Response('%PDF-test',{headers:{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename=ticket.pdf'}});
 try{
  const id='cfe109cf-4a7c-4ed8-9da7-6afcc111039e';
  for(const path of ['/api/bookings/mine','/api/bookings/options','/api/bookings/'+id+'/ticket'])assert.equal((await worker.fetch(new Request('https://gateway.example'+path),env)).status,200);
  const pdf=await worker.fetch(new Request('https://gateway.example/api/bookings/'+id+'/ticket'),env);assert.equal(pdf.headers.get('Content-Type'),'application/pdf');assert.equal(await pdf.text(),'%PDF-test');
  for(const operation of ['cancel','email'])assert.equal((await worker.fetch(new Request('https://gateway.example/api/bookings/'+id+'/'+operation,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}),env)).status,200);
  assert.equal((await worker.fetch(new Request('https://gateway.example/api/bookings/'+id+'/cancel'),env)).status,405);
 }finally{globalThis.fetch=original;}
});
test('profile and recovery gateway routes permit only their supported methods',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async()=>Response.json({ok:true});
 try{
  const authEnv={...env,AUTH_URL:'https://auth.example'};
  for(const path of ['profile','password','email/change','verification/request','verification/confirm','password/forgot','password/reset']){
   const result=await worker.fetch(new Request('https://gateway.example/api/auth/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}),authEnv);assert.equal(result.status,200);
  }
  assert.equal((await worker.fetch(new Request('https://gateway.example/api/auth/profile'),authEnv)).status,200);
  assert.equal((await worker.fetch(new Request('https://gateway.example/api/auth/password/reset'),authEnv)).status,405);
 }finally{globalThis.fetch=original;}
});
test('demo OTP route is forwarded as POST only',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async(url)=>{assert.equal(String(url),'https://bookings.example/api/bookings/payment/otp');return Response.json({delivery:'demo_preview'});};
 try{assert.equal((await worker.fetch(new Request('https://gateway.example/api/bookings/payment/otp',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}),env)).status,200);assert.equal((await worker.fetch(new Request('https://gateway.example/api/bookings/payment/otp'),env)).status,405);}finally{globalThis.fetch=original;}
});