import {service,wrap,internalOnly,call,failure,uuid} from '../../common/http.js';
const {app,pool,start}=service('reservations');
const seats=wrap(async(req,res)=>res.json((await pool.query('SELECT seat FROM reservations.seats WHERE showtime_id=$1 ORDER BY seat',[req.query.showtimeId])).rows.map(row=>row.seat)));
app.get('/api/reservations/seats',seats);app.get('/api/bookings/seats',seats);
app.post('/internal/reservations',internalOnly,wrap(async(req,res)=>{
 const {bookingId,userId,showtimeId,seats:labels}=req.body||{};
 if(!uuid(bookingId)||!uuid(userId)||!Number.isSafeInteger(showtimeId)||!Array.isArray(labels)||labels.length<1||labels.length>8||new Set(labels).size!==labels.length)throw failure(400,'Invalid seat reservation.');
 const show=await call('showtimes','/api/showtimes/'+showtimeId);if(new Date(show.starts_at)<=new Date())throw failure(409,'This showtime has already started.');
 const layout=await call('seats','/api/seats?hallId='+show.hall_id);
 if(labels.some(label=>!layout.some(seat=>seat.label===label)))throw failure(400,'A selected seat does not exist in this hall.');
 const client=await pool.connect();
 try{
  await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[bookingId]);
  const existing=(await client.query('SELECT * FROM reservations.seats WHERE reservation_id=$1',[bookingId])).rows;
  if(existing.length){if(existing.length!==labels.length||existing.some(row=>row.showtime_id!==showtimeId||row.user_id!==userId||!labels.includes(row.seat)))throw failure(409,'Reservation ID already has another selection.');}
  else for(const label of [...labels].sort())await client.query('INSERT INTO reservations.seats(showtime_id,seat,reservation_id,user_id) VALUES($1,$2,$3,$4)',[showtimeId,label,bookingId,userId]);
  await client.query('COMMIT');res.json({bookingId,seats:labels});
 }catch(error){await client.query('ROLLBACK');if(error.code==='23505')throw failure(409,'One of these seats was just booked. Choose other seats.');throw error;}finally{client.release();}
}));
start();
