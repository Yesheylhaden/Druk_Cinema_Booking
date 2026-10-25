import express from 'express';
import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {validBooking} from './validation.js';
const app=express(),pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
app.use(express.json({limit:'16kb'}));
app.get('/health',async(req,res)=>{try{await pool.query('SELECT 1');res.json({status:'ok'});}catch{res.status(503).json({error:'Database unavailable'});}});
app.get('/api/bookings/seats',async(req,res,next)=>{try{res.json((await pool.query('SELECT seat FROM booking.seats WHERE showtime_id=$1',[req.query.showtimeId])).rows.map(r=>r.seat));}catch(e){next(e);}});
app.post('/api/bookings',async(req,res,next)=>{
 if(!validBooking(req.body))return res.status(400).json({error:'Enter a valid name, email, showtime and 1–8 different seats.'});
 let client;
 try{
 const response=await fetch((process.env.CATALOG_URL||'http://localhost:4001')+'/api/showtimes?movieId='+req.body.movieId,{signal:AbortSignal.timeout(5000)});
 if(!response.ok)throw Error('Catalog unavailable');
 const show=(await response.json()).find(s=>s.id===req.body.showtimeId);
 if(!show)return res.status(400).json({error:'This showtime is no longer available.'});
 client=await pool.connect();await client.query('BEGIN');
 const reference=randomUUID(),total=Number(show.price)*req.body.seats.length;
 await client.query('INSERT INTO booking.reservations(id,showtime_id,name,email,total) VALUES($1,$2,$3,$4,$5)',[reference,show.id,req.body.name.trim(),req.body.email.trim(),total]);
 for(const seat of req.body.seats)await client.query('INSERT INTO booking.seats(showtime_id,seat,reservation_id) VALUES($1,$2,$3)',[show.id,seat,reference]);
 await client.query('COMMIT');res.status(201).json({reference,total,seats:req.body.seats});
 }catch(e){if(client)await client.query('ROLLBACK');if(e.code==='23505')return res.status(409).json({error:'A selected seat was just reserved. Choose another seat.'});next(e);}finally{client?.release();}
});
app.use((err,req,res,next)=>{console.error(err.message);res.status(err.type==='entity.parse.failed'?400:503).json({error:'Reservation service unavailable. Please try again.'});});
app.listen(process.env.PORT||4002,'0.0.0.0');