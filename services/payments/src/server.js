import {randomUUID} from 'node:crypto';
import {service,wrap,authenticate,internalOnly,call,notificationsReady,failure,uuid} from '../../common/http.js';
import {otpRequest,selectionHash,otpMatches} from './otp.js';
import {demoPaymentsEnabled} from './payment-mode.js';
import {validBooking} from '../../common/booking-validation.js';
const {app,pool,start}=service('payments');
app.use('/api/payments',authenticate());app.use('/api/bookings',authenticate());
const options=wrap(async(_req,res)=>{const demo=demoPaymentsEnabled(process.env);res.json({payment:{provider:demo?'Demo simulator':'Bank of Bhutan',available:demo,demo,message:demo?'DEMO ONLY — no money is charged and no bank is contacted. Confirm using a Druk Cinema demo email code. Demo tickets are not valid for admission.':'Payment is required during booking. Bank checkout is not configured.'},emailAvailable:await notificationsReady()});});
app.get('/api/payments/options',options);app.get('/api/bookings/options',options);
app.post('/api/payments/otp',wrap(otpRequest(pool)));app.post('/api/bookings/payment/otp',wrap(otpRequest(pool)));
app.post('/api/payments/authorize',wrap(async(req,res)=>{
 if(!demoPaymentsEnabled(process.env))throw failure(503,'Payment is required before booking. Bank checkout is not configured.','PAYMENT_UNAVAILABLE');
 const body={...req.body,name:req.account.name,email:req.account.email};
 if(!validBooking(body)||!uuid(body.requestId)||body.acknowledgeDemo!==true||!['success','declined'].includes(body.demoPaymentResult))throw failure(400,'Review your seats and acknowledge demo payment.');
 const shows=await call('showtimes','/api/showtimes?movieId='+body.movieId),show=shows.find(item=>item.id===body.showtimeId);if(!show)throw failure(400,'Choose an upcoming showtime.');
 const total=Number(show.price)*body.seats.length,hash=selectionHash(body,total),client=await pool.connect();
 try{
  await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[req.account.id+body.requestId]);
  const old=(await client.query('SELECT * FROM payments.transactions WHERE user_id=$1 AND request_id=$2',[req.account.id,body.requestId])).rows[0];
  if(old){await client.query('COMMIT');if(old.selection_hash!==hash||old.status==='void')throw failure(409,'This payment request cannot be used for this selection.');return res.json(old);}
  const challenge=(await client.query('SELECT * FROM payments.demo_otps WHERE user_id=$1 AND request_id=$2 FOR UPDATE',[req.account.id,body.requestId])).rows[0];
  if(!challenge||challenge.consumed_at||new Date(challenge.expires_at)<=new Date()||challenge.selection_hash!==hash){await client.query('ROLLBACK');throw failure(400,'Request a new demo payment code for this selection.','OTP_REQUIRED');}
  if(challenge.attempts>=5){await client.query('ROLLBACK');throw failure(429,'Too many incorrect codes. Request a new code after the cooldown.','OTP_LOCKED');}
  if(!otpMatches(body.otp,challenge)){await client.query('UPDATE payments.demo_otps SET attempts=attempts+1 WHERE user_id=$1 AND request_id=$2',[req.account.id,body.requestId]);await client.query('COMMIT');throw failure(400,'Incorrect code. Enter the six-digit demo code.','OTP_INVALID');}
  if(body.demoPaymentResult==='declined'){await client.query('ROLLBACK');throw failure(402,'Demo payment declined. No booking was created or money charged.','DEMO_DECLINED');}
  const row=(await client.query("INSERT INTO payments.transactions(id,user_id,request_id,selection_hash,showtime_id,seats,total,status,payment_reference) VALUES($1,$2,$3,$4,$5,$6,$7,'authorized',$8) RETURNING *",[randomUUID(),req.account.id,body.requestId,hash,show.id,body.seats,total,'DEMO-'+randomUUID()])).rows[0];
  await client.query('UPDATE payments.demo_otps SET consumed_at=NOW() WHERE user_id=$1 AND request_id=$2',[req.account.id,body.requestId]);await client.query('COMMIT');res.json(row);
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}));
app.post('/internal/payments/:id/capture',internalOnly,wrap(async(req,res)=>{
 if(!uuid(req.params.id)||!uuid(req.body?.bookingId))throw failure(400,'Invalid payment capture.');
 const row=(await pool.query("UPDATE payments.transactions SET status='captured',booking_id=$2 WHERE id=$1 AND (status='authorized' OR status='captured' AND booking_id=$2) RETURNING *",[req.params.id,req.body.bookingId])).rows[0];
 if(!row)throw failure(409,'Payment authorization is not available.');res.json(row);
}));
app.post('/internal/payments/:id/void',internalOnly,wrap(async(req,res)=>{if(!uuid(req.params.id))throw failure(400,'Invalid payment.');await pool.query("UPDATE payments.transactions SET status='void' WHERE id=$1 AND status='authorized'",[req.params.id]);res.json({ok:true});}));
start();
