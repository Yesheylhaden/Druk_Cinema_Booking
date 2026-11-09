import {service,wrap,call,failure} from '../../common/http.js';
const {app,pool,start}=service('showtimes');
let lastSeed=0;
async function seed(){
 if(Date.now()-lastSeed<60000)return;
 const [movies,cinemas,halls]=await Promise.all([call('movies','/api/movies'),call('cinemas','/api/cinemas'),call('halls','/api/halls')]);
 const client=await pool.connect();
 try{
  await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(20261107)');
  for(const movie of movies.filter(item=>item.listing_status==='now_showing')){
   for(const hall of halls){
    const cinema=cinemas.find(item=>item.id===hall.cinema_id);if(!cinema)continue;
    const times=cinema.id===1?['10:30','13:45','17:30','20:00']:['09:00','12:00','15:00','18:00'];
    await client.query(`INSERT INTO showtimes.slots(movie_id,theatre_id,hall_id,starts_at,auditorium,price,theatre_name,city)
     SELECT $1,$2,$3,(d.day+t.clock::time) AT TIME ZONE 'Asia/Thimphu',$4,350,$5,$6
     FROM (SELECT ((NOW() AT TIME ZONE 'Asia/Thimphu')::date+n)::date AS day FROM generate_series(0,13) n) d CROSS JOIN unnest($7::text[]) t(clock)
     WHERE NOT EXISTS(SELECT 1 FROM showtimes.slots s WHERE s.movie_id=$1 AND s.hall_id=$3 AND (s.starts_at AT TIME ZONE 'Asia/Thimphu')::date=d.day)
     ON CONFLICT(movie_id,theatre_id,starts_at) DO NOTHING`,[movie.id,cinema.id,hall.id,cinema.name+' · '+cinema.city+' · '+hall.name,cinema.name,cinema.city,times]);
   }
  }
  await client.query('COMMIT');lastSeed=Date.now();
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
app.get('/api/showtimes',wrap(async(req,res)=>{
 const movie=await call('movies','/api/movies/'+encodeURIComponent(req.query.movieId||''));
 if(movie.listing_status!=='now_showing')return res.json([]);
 await seed();
 res.json((await pool.query('SELECT * FROM showtimes.slots WHERE movie_id=$1 AND starts_at>NOW() AND ($2::integer IS NULL OR theatre_id=$2) ORDER BY starts_at,theatre_id',[movie.id,req.query.theatreId||null])).rows);
}));
app.get('/api/showtimes/:id',wrap(async(req,res)=>{
 const show=(await pool.query('SELECT * FROM showtimes.slots WHERE id=$1',[req.params.id])).rows[0];if(!show)throw failure(404,'Showtime not found.');
 const movie=await call('movies','/api/movies/'+show.movie_id);res.json({...show,movie_title:movie.title});
}));
start();
