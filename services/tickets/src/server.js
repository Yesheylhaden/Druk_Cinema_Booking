import {service,wrap,authenticate,call,notificationsReady,notify,failure,uuid} from '../../common/http.js';
import {ticketPdf} from './pdf.js';
import {ticketQr} from './qr.js';
const {app,pool,start}=service('tickets');app.use('/api',authenticate());
app.param('id',(req,res,next)=>{if(!uuid(req.params.id))return res.status(404).json({error:'Booking not found.'});next();});
async function booking(req){const row=await call('bookings','/api/bookings/'+req.params.id,{cookie:req.headers.cookie});if(row.status!=='confirmed')throw failure(409,'Only confirmed bookings have tickets.');return row;}
const raw=row=>({id:row.reference,name:row.name,email:row.email,movie_title:row.movieTitle,starts_at:row.startsAt,auditorium:row.auditorium,booked_seats:row.seats,total:row.total,payment_status:row.paymentStatus});
const pdf=wrap(async(req,res)=>{
 const row=await booking(req);if(!['paid','demo_paid'].includes(row.paymentStatus))throw failure(402,'Payment must be verified before a ticket can be issued.');
 await pool.query('INSERT INTO tickets.records(booking_id) VALUES($1) ON CONFLICT DO NOTHING',[row.reference]);res.type('application/pdf').attachment('druk-cinema-'+row.reference+'.pdf').send(await ticketPdf(raw(row)));
});
const email=wrap(async(req,res)=>{
 const row=await booking(req);if(row.paymentStatus!=='paid')throw failure(409,'Only confirmed, paid bookings have email tickets.');
 if(!await notificationsReady())throw failure(503,'Ticket email is not configured. Download your PDF instead.');
 await pool.query('INSERT INTO tickets.records(booking_id) VALUES($1) ON CONFLICT DO NOTHING',[row.reference]);
 const record=(await pool.query("UPDATE tickets.records SET email_attempts=email_attempts+1,email_requested_at=NOW() WHERE booking_id=$1 AND email_attempts<5 AND (email_requested_at IS NULL OR email_requested_at<NOW()-INTERVAL '2 minutes') RETURNING *",[row.reference])).rows[0];
 if(!record)throw failure(429,'Wait before requesting another ticket email.');
 const content=await ticketPdf(raw(row));await notify({to:row.email,subject:'Your Druk Cinema ticket',text:'Your ticket is attached. Reference: '+row.reference+'. Booked tickets cannot be cancelled.',attachments:[{filename:'druk-cinema-'+row.reference+'.pdf',base64:content.toString('base64')}]});
 await pool.query('UPDATE tickets.records SET emailed_at=NOW() WHERE booking_id=$1',[row.reference]);res.json({message:'Your ticket was accepted by the email service for delivery.'});
});
app.get('/api/tickets/:id/qr',wrap(async(req,res)=>{const row=await booking(req);if(!['paid','demo_paid'].includes(row.paymentStatus))throw failure(402,'Payment must be verified before a ticket can be issued.');res.set('Cache-Control','no-store').json(await ticketQr(row.reference));}));
app.get('/api/tickets/:id/pdf',pdf);app.get('/api/bookings/:id/ticket',pdf);app.post('/api/tickets/:id/email',email);app.post('/api/bookings/:id/email',email);
start();
