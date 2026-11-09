import {service,wrap,authenticate,notificationsReady,failure} from '../../common/http.js';
const {app,pool,start}=service('profiles');
app.use('/api/profiles',authenticate());
async function profile(identity){
 await pool.query('INSERT INTO profiles.users(user_id,name,created_at) VALUES($1,$2,$3) ON CONFLICT(user_id) DO NOTHING',[identity.id,identity.name,identity.createdAt||new Date()]);
 const row=(await pool.query('SELECT * FROM profiles.users WHERE user_id=$1',[identity.id])).rows[0];
 return {...identity,name:row.name,phone:row.phone,createdAt:row.created_at};
}
app.get('/api/profiles/me',wrap(async(req,res)=>res.json({user:await profile(req.account),emailAvailable:await notificationsReady()})));
app.post('/api/profiles/me',wrap(async(req,res)=>{
 const {name,phone=''}=req.body||{};
 if(typeof name!=='string'||name.trim().length<2||name.trim().length>100||typeof phone!=='string'||phone.length>30||phone&&!/^[+\d ()-]{5,30}$/.test(phone))throw failure(400,'Enter a name of 2–100 characters and a valid optional phone number.');
 await profile(req.account);
 const row=(await pool.query('UPDATE profiles.users SET name=$2,phone=$3,updated_at=NOW() WHERE user_id=$1 RETURNING *',[req.account.id,name.trim(),phone.trim()])).rows[0];
 res.json({user:{...req.account,name:row.name,phone:row.phone,createdAt:row.created_at},message:'Profile updated.'});
}));
start();
