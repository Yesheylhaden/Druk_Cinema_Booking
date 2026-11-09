import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID} from 'node:crypto';
const exec=promisify(execFile),enabled=process.env.RUN_INTEGRATION==='1';
const manifest=JSON.parse(await readFile(new URL('../services/manifest.json',import.meta.url),'utf8'));
test('independent runtime services own and cannot cross-read their schemas',{skip:!enabled},async()=>{
 for(const service of manifest){
  const response=await fetch('http://localhost:'+service.port+'/health');assert.equal(response.status,200);assert.equal((await response.json()).service,service.name);
  const tables={auth:'identity.users',profiles:'profiles.users',movies:'movies.movies',cinemas:'cinemas.cinemas',halls:'halls.halls',seats:'seats.seats',showtimes:'showtimes.slots',reservations:'reservations.seats',payments:'payments.transactions',tickets:'tickets.records',notifications:'notifications.deliveries',search:'search.documents',bookings:'booking.reservations'};
  const forbidden=service.name==='auth'?'profiles.users':'identity.users';
  const script=`import pg from 'pg';const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});const identity=(await pool.query('SELECT current_user')).rows[0].current_user;if(identity!=='${service.role}')throw Error('Wrong runtime role');await pool.query('SELECT 1 FROM ${tables[service.name]} LIMIT 1');let denied=false;try{await pool.query('SELECT 1 FROM ${forbidden} LIMIT 1');}catch(error){denied=error.code==='42501';}if(!denied)throw Error('Cross-service schema access was not blocked');await pool.end();console.log('schema isolation passed');`;
  const result=await exec('docker',['compose','exec','-T',service.name,'node','--input-type=module','-e',script]);assert.match(result.stdout,/schema isolation passed/);
 }
});
test('public domain APIs and search index are operational',{skip:!enabled},async()=>{
 const cinemas=await(await fetch('http://localhost:4005/api/cinemas')).json();assert.equal(cinemas.length,2);
 const halls=await(await fetch('http://localhost:4007/api/halls?cinemaId='+cinemas[0].id)).json();assert.equal(halls.length,1);assert.equal(halls[0].cinema_id,cinemas[0].id);
 const seats=await(await fetch('http://localhost:4008/api/seats?hallId='+halls[0].id)).json();assert.equal(seats.length,60);assert.equal(new Set(seats.map(seat=>seat.label)).size,60);
 const search=await fetch('http://localhost:4013/api/search?q=Dorozam');assert.equal(search.status,200);assert.ok((await search.json()).some(movie=>movie.title==='Dorozam'));
 assert.equal((await fetch('http://localhost:4012/internal/notifications',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,403);
 assert.equal((await fetch('http://localhost:4009/internal/reservations',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,403);
 assert.equal((await fetch('http://localhost:4011/api/tickets/'+randomUUID()+'/pdf')).status,401);
});
test('profile canonical data is independent of authentication bootstrap data',{skip:!enabled},async()=>{
 const response=await fetch('http://localhost:4003/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Bootstrap Name',email:'ownership-'+randomUUID()+'@example.com',password:'Microservice test password 2026!'})});assert.equal(response.status,201);
 const user=(await response.json()).user,cookie=response.headers.get('set-cookie').split(';')[0];assert.match(user.id,/^[a-f0-9-]{36}$/);
 try{
  const update=await fetch('http://localhost:4004/api/profiles/me',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({name:'Independent Profile',phone:'+975 17123456'})});assert.equal(update.status,200);assert.equal((await update.json()).user.name,'Independent Profile');
  const auth=await fetch('http://localhost:4003/api/auth/me',{headers:{Cookie:cookie}});assert.equal(auth.status,200);
  const profile=await(await fetch('http://localhost:4004/api/profiles/me',{headers:{Cookie:cookie}})).json();assert.equal(profile.user.name,'Independent Profile');assert.equal(profile.user.id,user.id);
 }finally{await exec('docker',['compose','exec','-T','postgres','psql','-U','druk','-d','druk_cinema','-c',"DELETE FROM profiles.users WHERE user_id='"+user.id+"'; DELETE FROM identity.users WHERE id='"+user.id+"';"]);}
});

test('pending bookings resume confirmation across Reservation and Payment services',{skip:!enabled},async(t)=>{
 const registered=await fetch('http://localhost:4003/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Retry Test',email:'retry-'+randomUUID()+'@example.com',password:'Microservice retry test 2026!'})});assert.equal(registered.status,201);
 const user=(await registered.json()).user,cookie=registered.headers.get('set-cookie').split(';')[0],bookingId=randomUUID(),paymentId=randomUUID(),requestId=randomUUID();
 const run=q=>exec('docker',['compose','exec','-T','postgres','psql','-U','druk','-d','druk_cinema','-v','ON_ERROR_STOP=1','-At','-c',q]);
 try{
  const options=await(await fetch('http://localhost:4010/api/payments/options',{headers:{Cookie:cookie}})).json();if(!options.payment.demo){t.skip('Demo mode is needed for confirmation recovery checks.');return;}
  const movies=await(await fetch('http://localhost:4001/api/movies')).json(),shows=await(await fetch('http://localhost:4006/api/showtimes?movieId='+movies[0].id)).json(),show=shows.find(item=>new Date(item.starts_at).getTime()>Date.now()+300000);assert.ok(show);
  const taken=await(await fetch('http://localhost:4009/api/reservations/seats?showtimeId='+show.id)).json(),seat=Array.from({length:60},(_,i)=>'ABCDEF'[Math.floor(i/10)]+(i%10+1)).find(label=>!taken.includes(label));assert.ok(seat);
  await run("BEGIN; INSERT INTO payments.transactions(id,user_id,request_id,selection_hash,showtime_id,seats,total,status,payment_reference) VALUES('"+paymentId+"','"+user.id+"','"+requestId+"',repeat('a',64),"+show.id+",ARRAY['"+seat+"'],"+Number(show.price)+",'authorized','DEMO-"+paymentId+"'); INSERT INTO booking.reservations(id,showtime_id,name,email,total,user_id,movie_title,starts_at,auditorium,booked_seats,request_key,payment_status,payment_reference,payment_id,status) VALUES('"+bookingId+"',"+show.id+",'Retry Test','retry@example.com',"+Number(show.price)+",'"+user.id+"','Test Movie','"+new Date(show.starts_at).toISOString()+"','Test Hall',ARRAY['"+seat+"'],'"+requestId+"','pending','DEMO-"+paymentId+"','"+paymentId+"','pending_confirmation'); COMMIT;");
  const confirm=()=>fetch('http://localhost:4002/api/bookings/'+bookingId+'/confirm',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:'{}'});
  let response=await confirm();assert.equal(response.status,200);const row=await response.json();assert.equal(row.status,'confirmed');assert.equal(row.paymentStatus,'demo_paid');
  const qrResponse=await fetch('http://localhost:4011/api/tickets/'+bookingId+'/qr',{headers:{Cookie:cookie}});assert.equal(qrResponse.status,200);const qr=await qrResponse.json();assert.match(qr.image,/^data:image\/png;base64,/);assert.equal(new URL(qr.url).hash,'#/ticket/'+bookingId);
  assert.equal((await fetch('http://localhost:4011/api/tickets/'+bookingId+'/qr')).status,401);
  const pdfResponse=await fetch('http://localhost:4011/api/tickets/'+bookingId+'/pdf',{headers:{Cookie:cookie}});assert.equal(pdfResponse.status,200);assert.ok((await pdfResponse.arrayBuffer()).byteLength>1000);
  response=await confirm();assert.equal(response.status,200);assert.equal((await response.json()).reference,bookingId);
  assert.match((await run("SELECT status FROM payments.transactions WHERE id='"+paymentId+"'")).stdout,/captured/);
  assert.equal(Number((await run("SELECT COUNT(*) FROM reservations.seats WHERE reservation_id='"+bookingId+"'")).stdout.trim()),1);
 }finally{await run("BEGIN; DELETE FROM tickets.records WHERE booking_id='"+bookingId+"'; DELETE FROM reservations.seats WHERE reservation_id='"+bookingId+"'; DELETE FROM booking.reservations WHERE id='"+bookingId+"'; DELETE FROM payments.transactions WHERE id='"+paymentId+"'; DELETE FROM profiles.users WHERE user_id='"+user.id+"'; DELETE FROM identity.users WHERE id='"+user.id+"'; COMMIT;");}
});
