import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile),enabled=process.env.RUN_INTEGRATION==='1';
const catalog=process.env.CATALOG_TEST_URL||'http://localhost:4001',bookings=process.env.BOOKINGS_TEST_URL||'http://localhost:4002',auth=process.env.AUTH_TEST_URL||'http://localhost:4003';
async function ready(url){for(let i=0;i<30;i++){try{if((await fetch(url+'/health')).ok)return;}catch{}await new Promise(r=>setTimeout(r,1000));}throw Error(url+' not healthy');}
const sql=statement=>exec('docker',['compose','exec','-T','postgres','psql','-U','druk','-d','druk_cinema','-v','ON_ERROR_STOP=1','-c',statement]);
test('payment required, unpaid tickets blocked, bookings cannot be cancelled',{skip:!enabled},async(t)=>{
 await Promise.all([ready(auth),ready(catalog),ready(bookings)]);
 const email='policy-'+randomUUID()+'@example.com';
 const registered=await fetch(auth+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://localhost:5173'},body:JSON.stringify({name:'Policy Test',email,password:'Test account password 2026!'})});
 assert.equal(registered.status,201);const account=(await registered.json()).user;
 assert.match(account.id,/^[a-f0-9-]{36}$/);
 const cookie=registered.headers.get('set-cookie').split(';')[0];
 const request=(path,body)=>fetch(bookings+'/api/bookings'+path,{method:body?'POST':'GET',headers:{Cookie:cookie,Origin:'http://localhost:5173','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 assert.equal((await fetch(bookings+'/api/bookings/mine')).status,401);
 const movies=await(await fetch(catalog+'/api/movies')).json();
 const show=(await(await fetch(catalog+'/api/showtimes?movieId='+movies[0].id)).json())[0];assert.ok(show);
 const seats=await(await fetch(bookings+'/api/bookings/seats?showtimeId='+show.id)).json();
 const seat=Array.from({length:60},(_,i)=>'ABCDEF'[Math.floor(i/10)]+(i%10+1)).find(s=>!seats.includes(s));assert.ok(seat);
 const options=await(await request('/options')).json();if(options.payment.demo){t.skip('Payment-unavailable checks require DEMO_PAYMENTS=false.');return;}assert.equal(options.payment.available,false);assert.match(options.payment.message,/Payment is required/);
 const before=await(await request('/mine')).json();
 const blocked=await request('',{movieId:movies[0].id,showtimeId:show.id,seats:[seat],paymentStatus:'paid',transactionId:'forged'});
 assert.equal(blocked.status,503);assert.equal((await blocked.json()).code,'PAYMENT_UNAVAILABLE');
 assert.equal((await(await request('/mine')).json()).length,before.length);
 assert.deepEqual(await(await fetch(bookings+'/api/bookings/seats?showtimeId='+show.id)).json(),seats);
 // Database-only fixtures exercise existing paid/unpaid records; no payment API is bypassed.
 const id=randomUUID(),date=new Date(show.starts_at).toISOString();
 try{
  await sql("BEGIN; INSERT INTO booking.reservations(id,showtime_id,name,email,total,user_id,movie_title,starts_at,auditorium,booked_seats) VALUES('"+id+"',"+show.id+",'Policy Test','"+email+"',"+Number(show.price)+",'"+account.id+"','Policy Test Movie','"+date+"','Test Hall',ARRAY['"+seat+"']); INSERT INTO booking.seats(showtime_id,seat,reservation_id) VALUES("+show.id+",'"+seat+"','"+id+"'); COMMIT;");
  assert.equal((await request('/'+id+'/ticket')).status,402);
  assert.equal((await request('/'+id+'/email',{})).status,409);
  const denied=await request('/'+id+'/cancel',{});assert.equal(denied.status,409);
  let row=(await(await request('/mine')).json()).find(item=>item.reference===id);assert.equal(row.canCancel,false);assert.equal(row.status,'confirmed');
  assert.ok((await(await fetch(bookings+'/api/bookings/seats?showtimeId='+show.id)).json()).includes(seat));
  await sql("UPDATE booking.reservations SET payment_status='paid' WHERE id='"+id+"';");
  assert.equal((await request('/'+id+'/cancel',{})).status,409);
  const pdf=await request('/'+id+'/ticket');assert.equal(pdf.status,200);assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0,5).toString(),'%PDF-');
  row=(await(await request('/mine')).json()).find(item=>item.reference===id);assert.equal(row.paymentStatus,'paid');assert.equal(row.canCancel,false);
  const other=await fetch(auth+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Other Test',email:'other-'+randomUUID()+'@example.com',password:'Test account password 2026!'})});
  assert.equal(other.status,201);const otherCookie=other.headers.get('set-cookie').split(';')[0];
  assert.equal((await fetch(bookings+'/api/bookings/'+id+'/ticket',{headers:{Cookie:otherCookie}})).status,404);
 }finally{await sql("BEGIN; DELETE FROM booking.seats WHERE reservation_id='"+id+"'; DELETE FROM booking.reservations WHERE id='"+id+"' AND user_id='"+account.id+"'; COMMIT;");}
});
