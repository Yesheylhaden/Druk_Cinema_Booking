import express from 'express';
import pg from 'pg';
const app=express(),pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
app.get('/health',async(req,res)=>{try{await pool.query('SELECT 1');res.json({status:'ok'});}catch{res.status(503).json({error:'Database unavailable'});}});
app.get('/api/movies',async(req,res,next)=>{try{res.json((await pool.query('SELECT * FROM catalog.movies ORDER BY rating DESC')).rows);}catch(e){next(e);}});
app.get('/api/showtimes',async(req,res,next)=>{try{res.json((await pool.query('SELECT * FROM catalog.showtimes WHERE movie_id=$1 AND starts_at>NOW() ORDER BY starts_at',[req.query.movieId])).rows);}catch(e){next(e);}});
app.use((err,req,res,next)=>{console.error(err.message);res.status(503).json({error:'Movie service unavailable'});});
app.listen(process.env.PORT||4001,'0.0.0.0');
