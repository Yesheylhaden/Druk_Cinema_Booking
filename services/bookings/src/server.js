import {randomUUID} from 'node:crypto';
import {service,wrap,authenticate,call,failure,uuid,urlFor,notificationsReady} from '../../common/http.js';
import {validBooking} from '../../common/booking-validation.js';
const {app,pool,start}=service('bookings');
async function proxy(req,res,name,path){
 const upstream=await fetch(urlFor(name)+path,{method:req.method,headers:{Cookie:req.headers.cookie||'','Content-Type':'application/json',...(req.headers.origin?{Origin:req.headers.origin}:{})},body:req.method==='POST'?JSON.stringify(req.body):undefined,signal:AbortSignal.timeout(25000)});
 for(const header of ['Content-Type','Content-Disposition','Retry-After'])if(upstream.headers.has(header))res.set(header,upstream.headers.get(header));res.status(upstream.status).send(Buffer.from(await upstream.arrayBuffer()));
}
app.get('/api/bookings/seats',wrap((req,res)=>proxy(req,res,'reservations','/api/reservations/seats?showtimeId='+encodeURIComponent(req.query.showtimeId||''))));
app.get('/api/bookings/options',wrap((req,res)=>proxy(req,res,'payments','/api/payments/options')));
app.post('/api/bookings/payment/otp',wrap((req,res)=>proxy(req,res,'payments','/api/payments/otp')));
app.get('/api/bookings/:id/ticket',wrap((req,res)=>proxy(req,res,'tickets','/api/tickets/'+req.params.id+'/pdf')));
app.post('/api/bookings/:id/email',wrap((req,res)=>proxy(req,res,'tickets','/api/tickets/'+req.params.id+'/email')));
app.use('/api/bookings',authenticate());
async function hydrate(row){
 if(row.starts_at&&row.movie_title)return row;
 try{const show=await call('showtimes','/api/showtimes/'+row.showtime_id);return (await pool.query('UPDATE booking.reservations SET movie_title=$2,starts_at=$3,auditorium=$4 WHERE id=$1 RETURNING *',[row.id,show.movie_title,show.starts_at,show.auditorium])).rows[0];}catch{return row;}
}
function present(row,email=false){return {reference:row.id,movieTitle:row.movie_title||'Movie reservation',showtimeId:row.showtime_id,startsAt:row.starts_at,auditorium:row.auditorium,seats:row.booked_seats,total:Number(row.total),status:row.status,paymentStatus:row.payment_status,createdAt:row.created_at,cancelledAt:row.cancelled_at,emailedAt:row.emailed_at,emailAvailable:row.payment_status==='paid'&&email,demo:row.payment_status==='demo_paid',paymentReference:row.payment_reference,canCancel:false};}
app.get('/api/bookings/mine',wrap(async(req,res)=>{const rows=(await pool.query("SELECT * FROM booking.reservations WHERE user_id=$1 AND status<>'failed' ORDER BY created_at DESC LIMIT 200",[req.account.id])).rows;const email=await notificationsReady();res.json(await Promise.all(rows.map(async row=>present(await hydrate(row),email))));}));
async function confirmBooking(row){
 try{await call('reservations','/internal/reservations',{body:{bookingId:row.id,userId:row.user_id,showtimeId:row.showtime_id,seats:row.booked_seats},internal:true});}
 catch(error){if(error.status===409){await pool.query("UPDATE booking.reservations SET status='failed',failure_reason=$2 WHERE id=$1 AND status='pending_confirmation'",[row.id,error.message]);await call('payments','/internal/payments/'+row.payment_id+'/void',{body:{},internal:true}).catch(()=>{});}throw error;}
 // These operations are idempotent. A transient failure leaves a resumable pending booking.
 await call('payments','/internal/payments/'+row.payment_id+'/capture',{body:{bookingId:row.id},internal:true});
 row=(await pool.query("UPDATE booking.reservations SET status='confirmed',payment_status='demo_paid' WHERE id=$1 RETURNING *",[row.id])).rows[0];
 return row;
}
app.post('/api/bookings',wrap(async(req,res)=>{
 const body={...req.body,name:req.account.name,email:req.account.email};
 const paymentOptions=await call('payments','/api/payments/options',{cookie:req.headers.cookie});if(!paymentOptions.payment.available)throw failure(503,'Payment is required before booking. Bank checkout is not configured.','PAYMENT_UNAVAILABLE');
 if(!validBooking(body)||!uuid(body.requestId))throw failure(400,'Choose a valid showtime and seats.');
 let row=(await pool.query('SELECT * FROM booking.reservations WHERE user_id=$1 AND request_key=$2',[req.account.id,body.requestId])).rows[0];
 const matches=row=>row.showtime_id===body.showtimeId&&[...row.booked_seats].sort().join(',')===[...body.seats].sort().join(',');
 if(row&&!matches(row))throw failure(409,'This request was used for another selection.');
 if(row?.status==='confirmed')return res.json(present(row));
 if(row?.status==='failed')throw failure(409,row.failure_reason||'This booking attempt failed. Choose seats again.');
 const profile=await call('profiles','/api/profiles/me',{cookie:req.headers.cookie});
 const authorization=await call('payments','/api/payments/authorize',{body,cookie:req.headers.cookie});
 if(!row){
  const [show,movie]=await Promise.all([call('showtimes','/api/showtimes/'+body.showtimeId),call('movies','/api/movies/'+body.movieId)]);
  if(show.movie_id!==movie.id||movie.listing_status!=='now_showing')throw failure(400,'Movie and showtime do not match.');
  row=(await pool.query("INSERT INTO booking.reservations(id,showtime_id,name,email,total,user_id,movie_title,starts_at,auditorium,booked_seats,request_key,payment_status,payment_reference,payment_id,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending',$12,$13,'pending_confirmation') ON CONFLICT(user_id,request_key) DO NOTHING RETURNING *",[randomUUID(),show.id,profile.user.name,req.account.email,authorization.total,req.account.id,movie.title,show.starts_at,show.auditorium,body.seats,body.requestId,authorization.payment_reference,authorization.id])).rows[0];
  if(!row)row=(await pool.query('SELECT * FROM booking.reservations WHERE user_id=$1 AND request_key=$2',[req.account.id,body.requestId])).rows[0];
  if(!matches(row))throw failure(409,'This request was used for another selection.');
 }
 row=await confirmBooking(row);
 res.status(201).json(present(row));
}));
app.param('id',(req,res,next)=>{if(!uuid(req.params.id))return res.status(404).json({error:'Booking not found.'});next();});
async function owned(req){const row=(await pool.query('SELECT * FROM booking.reservations WHERE id=$1 AND user_id=$2',[req.params.id,req.account.id])).rows[0];if(!row)throw failure(404,'Booking not found.');return hydrate(row);}
app.get('/api/bookings/:id',wrap(async(req,res)=>{const row=await owned(req);res.json({...present(row),name:row.name,email:row.email,userId:row.user_id});}));
app.post('/api/bookings/:id/confirm',wrap(async(req,res)=>{let row=await owned(req);if(row.status==='confirmed')return res.json(present(row));if(row.status!=='pending_confirmation'||!row.payment_id)throw failure(409,'This booking cannot be confirmed.');row=await confirmBooking(row);res.json(present(row));}));
app.post('/api/bookings/:id/cancel',wrap(async(req,res)=>{await owned(req);throw failure(409,'Bookings are final and cannot be cancelled.');}));
start();
