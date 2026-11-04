import {otpRequest,selectionHash,otpMatches} from './otp.js';
import {randomUUID} from 'node:crypto';
import {validBooking} from './validation.js';
import {demoPaymentsEnabled} from './payment-mode.js';
import express from 'express';
import pg from 'pg';
import {readFile} from 'node:fs/promises';
import {emailEnabled,ticketPdf,sendTicket} from './tickets.js';
const app=express(),pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
await pool.query(await readFile(new URL('./schema.sql',import.meta.url),'utf8'));
app.use(express.json({limit:'16kb'}));
app.use((_req,res,next)=>{res.set('Cache-Control','no-store');next();});
const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
app.get('/health',async(_req,res)=>{try{await pool.query('SELECT 1');res.json({status:'ok'});}catch{res.status(503).json({error:'Database unavailable'});}});
app.get('/api/bookings/seats',wrap(async(req,res)=>{res.json((await pool.query('SELECT seat FROM booking.seats WHERE showtime_id=$1',[req.query.showtimeId])).rows.map(r=>r.seat));}));
app.use('/api/bookings',wrap(async(req,res,next)=>{
 if(req.method==='POST'&&(!req.is('application/json')||req.headers.origin&&!(process.env.FRONTEND_ORIGIN||'http://localhost:5173').split(',').includes(req.headers.origin)||req.headers['sec-fetch-site']==='cross-site'))return res.status(403).json({error:'Request origin or content type is not allowed.'});
 const auth=await fetch((process.env.AUTH_URL||'http://localhost:4003')+'/api/auth/me',{headers:{Cookie:req.headers.cookie||''},signal:AbortSignal.timeout(5000)});
 if(auth.status===401)return res.status(401).json({error:'Please log in to manage your bookings.'});
 if(!auth.ok)return res.status(503).json({error:'Account service unavailable. Please try again.'});
 req.account=(await auth.json()).user;
 // This middleware is asynchronous, so explicitly continue after authentication.
 next();
}));

async function hydrate(row,client=pool){
 if(row.starts_at&&row.movie_title)return row;
 const response=await fetch((process.env.CATALOG_URL||'http://localhost:4001')+'/api/showtimes/'+row.showtime_id,{signal:AbortSignal.timeout(5000)});
 if(!response.ok)return row;
 const show=await response.json();
 const {rows}=await client.query('UPDATE booking.reservations SET movie_title=$2,starts_at=$3,auditorium=$4 WHERE id=$1 RETURNING *',[row.id,show.movie_title,show.starts_at,show.auditorium]);
 return rows[0];
}
function present(row){return {reference:row.id,movieTitle:row.movie_title||'Movie reservation',showtimeId:row.showtime_id,startsAt:row.starts_at,auditorium:row.auditorium,seats:row.booked_seats,total:Number(row.total),status:row.status,paymentStatus:row.payment_status,createdAt:row.created_at,cancelledAt:row.cancelled_at,emailedAt:row.emailed_at,emailAvailable:row.payment_status!=='demo_paid'&&emailEnabled(),demo:row.payment_status==='demo_paid',paymentReference:row.payment_reference,canCancel:false};}
app.get('/api/bookings/mine',wrap(async(req,res)=>{
 const {rows}=await pool.query('SELECT * FROM booking.reservations WHERE user_id=$1 ORDER BY created_at DESC LIMIT 200',[req.account.id]);
 const bookings=[];
 for(const row of rows){try{bookings.push(present(await hydrate(row)));}catch{bookings.push(present(row));}}
 res.json(bookings);
}));
app.get('/api/bookings/options',(_req,res)=>{const demo=demoPaymentsEnabled(process.env);res.json({payment:{provider:demo?'Demo simulator':'Bank of Bhutan',available:demo,demo,message:demo?'DEMO ONLY — no money is charged, no bank is contacted, and no bank credentials or bank OTP are required. Confirm using a Druk Cinema demo email code. Demo tickets are not valid for admission.':'Online bank checkout is not configured.'},emailAvailable:emailEnabled()});});
app.post('/api/bookings/payment/otp',wrap(otpRequest(pool)));
app.post('/api/bookings',wrap(async(req,res)=>{
 if(!demoPaymentsEnabled(process.env))return res.status(503).json({code:'PAYMENT_UNAVAILABLE',error:'Payment is required before booking. Bank checkout is not configured.'});
 const body={...req.body,name:req.account.name,email:req.account.email};
 if(!validBooking(body)||!uuid.test(body.requestId||'')||body.acknowledgeDemo!==true||!['success','declined'].includes(body.demoPaymentResult))return res.status(400).json({error:'Review your seats and acknowledge the demo payment. No bank details are needed.'});
 const old=(await pool.query('SELECT * FROM booking.reservations WHERE user_id=$1 AND request_key=$2',[req.account.id,body.requestId])).rows[0];
 const replay=row=>row.showtime_id===body.showtimeId&&[...row.booked_seats].sort().join(',')===[...body.seats].sort().join(',')?res.json(present(row)):res.status(409).json({error:'This request was used for a different booking.'});
 if(old)return replay(old);

 const base=process.env.CATALOG_URL||'http://localhost:4001';
 const response=await fetch(base+'/api/showtimes?movieId='+body.movieId,{signal:AbortSignal.timeout(5000)});if(!response.ok)throw Error('Catalog unavailable');
 const show=(await response.json()).find(row=>row.id===body.showtimeId);if(!show)return res.status(400).json({error:'Choose an upcoming showtime.'});
 const movieResponse=await fetch(base+'/api/movies',{signal:AbortSignal.timeout(5000)});if(!movieResponse.ok)throw Error('Catalog unavailable');
 const movie=(await movieResponse.json()).find(row=>row.id===body.movieId);if(!movie)return res.status(400).json({error:'Movie unavailable.'});
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  const challenge=(await client.query('SELECT * FROM booking.demo_otps WHERE user_id=$1 AND request_id=$2 FOR UPDATE',[req.account.id,body.requestId])).rows[0];
  if(challenge?.consumed_at){const previous=(await client.query('SELECT * FROM booking.reservations WHERE user_id=$1 AND request_key=$2',[req.account.id,body.requestId])).rows[0];await client.query('COMMIT');if(previous)return replay(previous);return res.status(400).json({code:'OTP_INVALID',error:'This code has already been used.'});}
  if(!challenge||new Date(challenge.expires_at)<=new Date()||challenge.selection_hash!==selectionHash(body,Number(show.price)*body.seats.length)){await client.query('ROLLBACK');return res.status(400).json({code:'OTP_REQUIRED',error:'Request a new demo payment code for this selection.'});}
  if(challenge.attempts>=5){await client.query('ROLLBACK');return res.status(429).json({code:'OTP_LOCKED',error:'Too many incorrect codes. Request a new code after the cooldown.'});}
  if(!otpMatches(body.otp,challenge)){await client.query('UPDATE booking.demo_otps SET attempts=attempts+1 WHERE user_id=$1 AND request_id=$2',[req.account.id,body.requestId]);await client.query('COMMIT');return res.status(400).json({code:'OTP_INVALID',error:'Incorrect code. Enter the six-digit demo code.'});}
  if(body.demoPaymentResult==='declined'){await client.query('ROLLBACK');return res.status(402).json({code:'DEMO_DECLINED',error:'Demo payment declined. No booking was created or money charged. Choose the successful demo option to try again.'});}
  const id=randomUUID(),total=Number(show.price)*body.seats.length;
  const {rows}=await client.query("INSERT INTO booking.reservations(id,showtime_id,name,email,total,user_id,movie_title,starts_at,auditorium,booked_seats,request_key,payment_status,payment_reference) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'demo_paid',$12) RETURNING *",[id,show.id,req.account.name,req.account.email,total,req.account.id,movie.title,show.starts_at,show.auditorium,body.seats,body.requestId,'DEMO-'+randomUUID()]);
  for(const seat of body.seats)await client.query('INSERT INTO booking.seats(showtime_id,seat,reservation_id) VALUES($1,$2,$3)',[show.id,seat,id]);
  await client.query('UPDATE booking.demo_otps SET consumed_at=NOW() WHERE user_id=$1 AND request_id=$2',[req.account.id,body.requestId]);
  await client.query('COMMIT');res.status(201).json(present(rows[0]));
 }catch(error){
  await client.query('ROLLBACK');
  if(error.code==='23505'){const prior=(await pool.query('SELECT * FROM booking.reservations WHERE user_id=$1 AND request_key=$2',[req.account.id,body.requestId])).rows[0];if(prior)return replay(prior);return res.status(409).json({error:'One of these seats was just booked. Choose other seats.'});}throw error;
 }finally{client.release();}
}));
app.param('id',(req,res,next)=>{if(!uuid.test(req.params.id))return res.status(404).json({error:'Booking not found.'});next();});
async function owned(req){return (await pool.query('SELECT * FROM booking.reservations WHERE id=$1 AND user_id=$2',[req.params.id,req.account.id])).rows[0];}
app.post('/api/bookings/:id/cancel',wrap(async(req,res)=>{
 const row=await owned(req);
 if(!row)return res.status(404).json({error:'Booking not found.'});
 res.status(409).json({error:'Bookings are final and cannot be cancelled.'});
}));
app.get('/api/bookings/:id/ticket',wrap(async(req,res)=>{
 let row=await owned(req);if(!row)return res.status(404).json({error:'Booking not found.'});
 if(row.status!=='confirmed')return res.status(409).json({error:'Cancelled bookings do not have active tickets.'});
 if(!['paid','demo_paid'].includes(row.payment_status))return res.status(402).json({error:'Payment must be verified before a ticket can be issued.'});
 row=await hydrate(row);
 res.type('application/pdf').attachment('druk-cinema-'+row.id+'.pdf').send(await ticketPdf(row));
}));
app.post('/api/bookings/:id/email',wrap(async(req,res)=>{
 const booking=await owned(req);if(!booking)return res.status(404).json({error:'Booking not found.'});
 if(booking.status!=='confirmed'||booking.payment_status!=='paid')return res.status(409).json({error:'Only confirmed, paid bookings have tickets.'});
 if(!emailEnabled())return res.status(503).json({error:'Ticket email is not configured yet. Download your PDF ticket instead.'});
 const {rows}=await pool.query("UPDATE booking.reservations SET email_requested_at=NOW(),email_attempts=email_attempts+1 WHERE id=$1 AND user_id=$2 AND status='confirmed' AND payment_status='paid' AND email_attempts<5 AND (email_requested_at IS NULL OR email_requested_at<NOW()-INTERVAL '2 minutes') RETURNING *",[booking.id,req.account.id]);
 if(!rows[0])return res.status(409).json({error:'Ticket email is unavailable for this booking, or was requested recently. Please wait before retrying.'});
 try{const row=await hydrate(rows[0]);await sendTicket(row,await ticketPdf(row));await pool.query('UPDATE booking.reservations SET emailed_at=NOW() WHERE id=$1',[row.id]);res.json({message:'Your ticket was accepted by the email service for delivery.'});}catch{res.status(503).json({error:'Email delivery could not be confirmed. Download your ticket or try again later.'});}
}));
app.use((error,_req,res,_next)=>{console.error(error.code||error.name);res.status(error.type==='entity.parse.failed'?400:503).json({error:error.type==='entity.parse.failed'?'Invalid request.':'Booking service unavailable. Please try again.'});});
app.listen(process.env.PORT||4002,'0.0.0.0');
