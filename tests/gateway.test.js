import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../services/gateway/src/worker.js';
import {resolveRoute} from '../services/gateway/src/routes.js';
const names=['auth','profiles','cinemas','movies','showtimes','halls','seats','reservations','payments','tickets','notifications','search','bookings'];
const env={FRONTEND_ORIGIN:'https://cinema.example',...Object.fromEntries(names.map(name=>[name.toUpperCase()+'_URL','https://'+name+'.example']))};
const id='cfe109cf-4a7c-4ed8-9da7-6afcc111039e';
test('gateway isolates the implemented domains and rewrites legacy aliases',()=>{
 for(const [path,method,service] of [
 ['/api/auth/me','GET','auth'],['/api/profiles/me','GET','profiles'],['/api/auth/profile','POST','profiles'],['/api/cinemas','GET','cinemas'],['/api/movies','GET','movies'],['/api/showtimes','GET','showtimes'],['/api/halls','GET','halls'],['/api/seats','GET','seats'],['/api/bookings/seats','GET','reservations'],['/api/bookings/options','GET','payments'],['/api/bookings/payment/otp','POST','payments'],['/api/payments/authorize','POST','payments'],['/api/tickets/'+id+'/pdf','GET','tickets'],['/api/bookings/'+id+'/ticket','GET','tickets'],['/api/notifications/capabilities','GET','notifications'],['/api/search','GET','search'],['/api/bookings/mine','GET','bookings']])assert.equal(resolveRoute(path,method).service,service);
 assert.equal(resolveRoute('/api/tickets/'+id+'/qr','GET').service,'tickets');
 assert.equal(resolveRoute('/api/bookings/'+id+'/confirm','POST').service,'bookings');
 assert.equal(resolveRoute('/internal/reservations','POST').status,404);
 assert.equal(resolveRoute('/api/payments/otp','GET').status,405);
 assert.equal(resolveRoute('/api/auth/password/reset','GET').status,405);
});
test('gateway enforces browser origins and preflight credentials',async()=>{
 assert.equal((await worker.fetch(new Request('https://gateway.example/api/movies',{headers:{Origin:'https://evil.example'}}),env)).status,403);
 const response=await worker.fetch(new Request('https://gateway.example/api/profiles/me',{method:'OPTIONS',headers:{Origin:env.FRONTEND_ORIGIN}}),env);
 assert.equal(response.status,204);assert.equal(response.headers.get('Access-Control-Allow-Credentials'),'true');
});
test('gateway routes queries and cookies without forwarding internal credentials',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async(url,options)=>{assert.equal(String(url),'https://reservations.example/api/reservations/seats?showtimeId=42');assert.equal(options.headers.get('Cookie'),'druk_session=opaque');assert.equal(options.headers.get('X-Service-Token'),null);return Response.json(['A1']);};
 try{const response=await worker.fetch(new Request('https://gateway.example/api/bookings/seats?showtimeId=42',{headers:{Cookie:'druk_session=opaque','X-Service-Token':'untrusted'}}),env);assert.equal(response.status,200);assert.deepEqual(await response.json(),['A1']);assert.equal(response.headers.get('Cache-Control'),'no-store');}finally{globalThis.fetch=original;}
});
test('gateway preserves session and PDF response headers',async()=>{
 const original=globalThis.fetch;
 try{
  globalThis.fetch=async()=>Response.json({user:{id}},{headers:{'Set-Cookie':'druk_session=new; HttpOnly; SameSite=Lax; Path=/api'}});
  let response=await worker.fetch(new Request('https://gateway.example/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}),env);assert.match(response.headers.get('Set-Cookie'),/druk_session=new/);
  globalThis.fetch=async(url)=>{assert.equal(String(url),'https://tickets.example/api/tickets/'+id+'/pdf');return new Response('%PDF-test',{headers:{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename=ticket.pdf'}});};
  response=await worker.fetch(new Request('https://gateway.example/api/bookings/'+id+'/ticket'),env);assert.equal(response.headers.get('Content-Type'),'application/pdf');assert.equal(await response.text(),'%PDF-test');
 }finally{globalThis.fetch=original;}
});
