import {service,wrap,failure} from '../../common/http.js';
const {app,pool,start}=service('movies');
app.get('/api/movies',wrap(async(_req,res)=>res.json((await pool.query("SELECT * FROM movies.movies ORDER BY (listing_status='now_showing') DESC,is_new DESC,rating DESC NULLS LAST,id DESC")).rows)));
app.get('/api/movies/:id',wrap(async(req,res)=>{const movie=(await pool.query('SELECT * FROM movies.movies WHERE id=$1',[req.params.id])).rows[0];if(!movie)throw failure(404,'Movie not found.');res.json(movie);}));
start();
