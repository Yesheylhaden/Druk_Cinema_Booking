import {service,wrap,failure} from '../../common/http.js';
const {app,pool,start}=service('cinemas');
app.get('/api/cinemas',wrap(async(_req,res)=>res.json((await pool.query('SELECT * FROM cinemas.cinemas ORDER BY id')).rows)));
app.get('/api/cinemas/:id',wrap(async(req,res)=>{const cinema=(await pool.query('SELECT * FROM cinemas.cinemas WHERE id=$1',[req.params.id])).rows[0];if(!cinema)throw failure(404,'Cinema not found.');res.json(cinema);}));
start();
