import {service,wrap,failure} from '../../common/http.js';
const {app,pool,start}=service('seats');
app.get('/api/seats',wrap(async(req,res)=>{
 if(!/^[1-9]\d*$/.test(req.query.hallId||''))throw failure(400,'Choose a hall.');
 res.json((await pool.query('SELECT * FROM seats.seats WHERE hall_id=$1 ORDER BY row_label,column_number',[req.query.hallId])).rows);
}));
start();
