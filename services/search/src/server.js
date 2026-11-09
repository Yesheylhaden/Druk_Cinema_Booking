import {service,wrap,call} from '../../common/http.js';
const {app,pool,start}=service('search');let indexedAt=0;
app.get('/api/search',wrap(async(req,res)=>{
 if(Date.now()-indexedAt>30000){
  const movies=await call('movies','/api/movies');const client=await pool.connect();
  try{await client.query('BEGIN');for(const movie of movies)await client.query('INSERT INTO search.documents(movie_id,title,document) VALUES($1,$2,$3) ON CONFLICT(movie_id) DO UPDATE SET title=EXCLUDED.title,document=EXCLUDED.document,updated_at=NOW()',[movie.id,movie.title,movie]);await client.query('DELETE FROM search.documents WHERE NOT(movie_id=ANY($1::integer[]))',[movies.map(movie=>movie.id)]);await client.query('COMMIT');indexedAt=Date.now();}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 }
 const q=String(req.query.q||'').slice(0,200),genre=req.query.genre||null;
 res.json((await pool.query("SELECT document FROM search.documents WHERE title ILIKE $1 AND ($2::text IS NULL OR document->'genres' ? $2) ORDER BY movie_id DESC",['%'+q.replace(/[\\%_]/g,'\\$&')+'%',genre])).rows.map(row=>row.document));
}));
start();
