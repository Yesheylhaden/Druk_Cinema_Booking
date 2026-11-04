import {randomInt,randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {validBooking} from './validation.js';
import {demoPaymentsEnabled} from './payment-mode.js';
import {emailEnabled,sendPaymentOtp} from './tickets.js';
export const selectionHash=(body,total)=>createHash('sha256').update(JSON.stringify([body.movieId,body.showtimeId,[...body.seats].sort(),Number(total)])).digest('hex');
export const otpHash=(code,salt)=>createHash('sha256').update(salt+':'+code).digest('hex');
export const otpMatches=(code,row)=>typeof code==='string'&&/^\d{6}$/.test(code)&&timingSafeEqual(Buffer.from(otpHash(code,row.salt),'hex'),Buffer.from(row.code_hash,'hex'));
export function otpRequest(pool){return async(req,res)=>{
 if(!demoPaymentsEnabled(process.env))return res.status(503).json({error:'Demo payments are not enabled.'});
 const body={...req.body,name:req.account.name,email:req.account.email};
 if(!validBooking(body)||!/^[a-f0-9-]{36}$/i.test(body.requestId||'')||body.acknowledgeDemo!==true)return res.status(400).json({error:'Select your seats and acknowledge demo payment first.'});
 const response=await fetch((process.env.CATALOG_URL||'http://localhost:4001')+'/api/showtimes?movieId='+body.movieId,{signal:AbortSignal.timeout(5000)});
 if(!response.ok)throw Error('Showtimes unavailable');
 const show=(await response.json()).find(item=>item.id===body.showtimeId);if(!show)return res.status(400).json({error:'This showtime is no longer available.'});
 const code=String(randomInt(0,1000000)).padStart(6,'0'),salt=randomBytes(16).toString('hex'),total=Number(show.price)*body.seats.length;
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[req.account.id]);
  const prior=(await client.query('SELECT created_at FROM booking.demo_otps WHERE user_id=$1 AND request_id=$2',[req.account.id,body.requestId])).rows[0];
  if(prior&&Date.now()-new Date(prior.created_at).getTime()<60000){await client.query('ROLLBACK');res.set('Retry-After','60');return res.status(429).json({error:'Wait one minute before requesting another code.'});}
  const rate=(await client.query("INSERT INTO booking.otp_limits(user_id,hits,resets_at) VALUES($1,1,NOW()+INTERVAL '15 minutes') ON CONFLICT(user_id) DO UPDATE SET hits=CASE WHEN booking.otp_limits.resets_at<NOW() THEN 1 ELSE booking.otp_limits.hits+1 END,resets_at=CASE WHEN booking.otp_limits.resets_at<NOW() THEN NOW()+INTERVAL '15 minutes' ELSE booking.otp_limits.resets_at END RETURNING hits",[req.account.id])).rows[0];
  if(rate.hits>5){await client.query('COMMIT');res.set('Retry-After','900');return res.status(429).json({error:'Too many code requests. Try again in 15 minutes.'});}
  await client.query("INSERT INTO booking.demo_otps(user_id,request_id,selection_hash,code_hash,salt,expires_at) VALUES($1,$2,$3,$4,$5,NOW()+INTERVAL '5 minutes') ON CONFLICT(user_id,request_id) DO UPDATE SET selection_hash=EXCLUDED.selection_hash,code_hash=EXCLUDED.code_hash,salt=EXCLUDED.salt,expires_at=EXCLUDED.expires_at,attempts=0,consumed_at=NULL,created_at=NOW()",[req.account.id,body.requestId,selectionHash(body,total),otpHash(code,salt),salt]);
  await client.query('COMMIT');
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 if(emailEnabled()){
  try{await sendPaymentOtp(req.account.email,code,total);}catch{await pool.query('DELETE FROM booking.demo_otps WHERE user_id=$1 AND request_id=$2 AND code_hash=$3',[req.account.id,body.requestId,otpHash(code,salt)]);return res.status(503).json({error:'Code delivery could not be confirmed. Please try again.'});}
  return res.json({delivery:'email',expiresIn:300,message:'A demo payment code was accepted by the email service for delivery to your account email. It expires in 5 minutes.'});
 }
 res.json({delivery:'demo_preview',demoCode:code,expiresIn:300,message:'SMTP is not configured. No email was sent. Use the displayed DEMO code to test checkout. This is not a bank OTP.'});
};}
