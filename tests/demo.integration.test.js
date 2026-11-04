import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile),base=process.env.BOOKINGS_TEST_URL||'http://localhost:4002',auth=process.env.AUTH_TEST_URL||'http://localhost:4003',catalog=process.env.CATALOG_TEST_URL||'http://localhost:4001';
test('demo payment success, decline, duplicate requests, tickets, and no cancellation',{skip:process.env.RUN_INTEGRATION!=='1'},async(t)=>{
 const email='demo-'+randomUUID()+'@example.com';
 const result=await fetch(auth+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Demo Test',email,password:'Demo test password 2026!'})});assert.equal(result.status,201);
 const user=(await result.json()).user,cookie=result.headers.get('set-cookie').split(';')[0];assert.match(user.id,/^[a-f0-9-]{36}$/);
 const request=(path,body)=>fetch(base+'/api/bookings'+path,{method:body?'POST':'GET',headers:{Cookie:cookie,Origin:'http://localhost:5173','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 try{
  const options=await(await request('/options')).json();if(!options.payment.demo){t.skip('Demo payments are not enabled on this service.');return;}
  const movies=await(await fetch(catalog+'/api/movies')).json(),shows=await(await fetch(catalog+'/api/showtimes?movieId='+movies[0].id)).json(),show=shows[0];assert.ok(show);assert.deepEqual([...new Set(shows.map(item=>item.theatre_id))].sort(),[1,2]);const otherShow=shows.find(item=>item.theatre_id!==show.theatre_id);const otherSeats=await(await fetch(base+'/api/bookings/seats?showtimeId='+otherShow.id)).json();
  const taken=await(await fetch(base+'/api/bookings/seats?showtimeId='+show.id)).json();
  const seat=Array.from({length:60},(_,i)=>'ABCDEF'[Math.floor(i/10)]+(i%10+1)).find(s=>!taken.includes(s));assert.ok(seat);
  if(options.emailAvailable){t.skip('Use unconfigured SMTP for preview-code integration tests; no external email is sent.');return;}
  const body={movieId:movies[0].id,showtimeId:show.id,seats:[seat],acknowledgeDemo:true,demoPaymentResult:'declined',requestId:randomUUID(),total:1,paymentStatus:'paid'};
  assert.equal((await request('',body)).status,400);
  const otpResponse=await request('/payment/otp',body);assert.equal(otpResponse.status,200);const otpInfo=await otpResponse.json();assert.equal(otpInfo.delivery,'demo_preview');assert.match(otpInfo.demoCode,/^\d{6}$/);body.otp=otpInfo.demoCode;
  assert.equal((await request('/payment/otp',body)).status,429);
  const wrong=await request('',{...body,otp:body.otp==='000000'?'000001':'000000'});assert.equal(wrong.status,400);assert.equal((await wrong.json()).code,'OTP_INVALID');
  const mismatch=await request('',{...body,seats:[seat==='F10'?'F9':'F10']});assert.equal(mismatch.status,400);assert.equal((await mismatch.json()).code,'OTP_REQUIRED');
  const decline=await request('',body);assert.equal(decline.status,402);assert.equal((await decline.json()).code,'DEMO_DECLINED');assert.equal((await(await request('/mine')).json()).length,0);
  assert.deepEqual(await(await fetch(base+'/api/bookings/seats?showtimeId='+show.id)).json(),taken);
  body.demoPaymentResult='success';
  const competing={...body,requestId:randomUUID()};const competingOtp=await request('/payment/otp',competing);assert.equal(competingOtp.status,200);competing.otp=(await competingOtp.json()).demoCode;const attempts=await Promise.all([request('',body),request('',competing)]);assert.deepEqual(attempts.map(r=>r.status).sort(),[201,409]);
  const receipt=await attempts.find(r=>r.status===201).json();assert.equal(receipt.paymentStatus,'demo_paid');assert.equal(receipt.demo,true);assert.match(receipt.paymentReference,/^DEMO-/);assert.equal(receipt.total,Number(show.price));assert.equal(receipt.emailAvailable,false);assert.equal(receipt.canCancel,false);assert.ok(receipt.auditorium.includes(show.theatre_name));assert.deepEqual(await(await fetch(base+'/api/bookings/seats?showtimeId='+otherShow.id)).json(),otherSeats);
  const history=await(await request('/mine')).json();assert.equal(history.length,1);assert.equal(history[0].reference,receipt.reference);
  // Replay with the original request key only if it won the concurrent race.
  const replay=await request('',attempts[0].status===201?body:competing);
  assert.equal(replay.status,200);assert.equal((await(await request('/mine')).json()).length,1);
  assert.equal((await request('/'+receipt.reference+'/cancel',{})).status,409);
  assert.equal((await request('/'+receipt.reference+'/email',{})).status,409);
  const pdf=await request('/'+receipt.reference+'/ticket');assert.equal(pdf.status,200);assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0,5).toString(),'%PDF-');
  assert.ok((await(await fetch(base+'/api/bookings/seats?showtimeId='+show.id)).json()).includes(seat));
  const expiredBody={...body,requestId:randomUUID()};const expiredOtp=await request('/payment/otp',expiredBody);assert.equal(expiredOtp.status,200);expiredBody.otp=(await expiredOtp.json()).demoCode;
  await exec('docker',['compose','exec','-T','postgres','psql','-U','druk','-d','druk_cinema','-c',"UPDATE booking.demo_otps SET expires_at=NOW()-INTERVAL '1 second' WHERE user_id='"+user.id+"' AND request_id='"+expiredBody.requestId+"'"]);
  const expiredResult=await request('',expiredBody);assert.equal(expiredResult.status,400);assert.equal((await expiredResult.json()).code,'OTP_REQUIRED');
  const lockedBody={...body,requestId:randomUUID()};const lockedResponse=await request('/payment/otp',lockedBody);assert.equal(lockedResponse.status,200);const validLockedCode=(await lockedResponse.json()).demoCode;lockedBody.otp=validLockedCode==='000000'?'000001':'000000';
  for(let i=0;i<5;i++)assert.equal((await request('',lockedBody)).status,400);
  const lockedAttempt=await request('',{...lockedBody,otp:validLockedCode});assert.equal(lockedAttempt.status,429);assert.equal((await lockedAttempt.json()).code,'OTP_LOCKED');
 }finally{
  await exec('docker',['compose','exec','-T','postgres','psql','-U','druk','-d','druk_cinema','-v','ON_ERROR_STOP=1','-c',"BEGIN; DELETE FROM booking.demo_otps WHERE user_id='"+user.id+"'; DELETE FROM booking.otp_limits WHERE user_id='"+user.id+"'; DELETE FROM booking.seats WHERE reservation_id IN(SELECT id FROM booking.reservations WHERE user_id='"+user.id+"'); DELETE FROM booking.reservations WHERE user_id='"+user.id+"'; DELETE FROM identity.users WHERE id='"+user.id+"'; COMMIT;"]);
 }
});