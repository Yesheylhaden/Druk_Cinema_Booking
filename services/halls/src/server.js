import {service,wrap,failure} from '../../common/http.js';
const {app,pool,start}=service('halls');
app.get('/api/halls',wrap(async(req,res)=>res.json((await pool.query('SELECT * FROM halls.halls WHERE ($1::integer IS NULL OR cinema_id=$1) ORDER BY id',[req.query.cinemaId||null])).rows)));
app.get('/api/halls/:id',wrap(async(req,res)=>{const hall=(await pool.query('SELECT * FROM halls.halls WHERE id=$1',[req.params.id])).rows[0];if(!hall)throw failure(404,'Hall not found.');res.json(hall);}));
start();
