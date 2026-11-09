import {emailEnabled as ready} from './config.js';
import nodemailer from 'nodemailer';
import {randomUUID} from 'node:crypto';
import {service,wrap,internalOnly,failure} from '../../common/http.js';
const {app,pool,start}=service('notifications');

app.get('/api/notifications/capabilities',(_req,res)=>res.json({available:ready()}));
app.post('/internal/notifications',internalOnly,wrap(async(req,res)=>{
 if(!ready())throw failure(503,'Email delivery is not configured.');
 const {to,subject,text,attachments=[]}=req.body||{};
 if(typeof to!=='string'||to.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)||typeof subject!=='string'||subject.length>200||typeof text!=='string'||text.length>20000||!Array.isArray(attachments)||attachments.length>1)throw failure(400,'Invalid notification.');
 const id=randomUUID();await pool.query("INSERT INTO notifications.deliveries(id,recipient,subject,status) VALUES($1,$2,$3,'pending')",[id,to,subject]);
 const port=Number(process.env.SMTP_PORT||587),transport=nodemailer.createTransport({host:process.env.SMTP_HOST,port,secure:port===465,requireTLS:port!==465,auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD},connectionTimeout:5000,greetingTimeout:5000,socketTimeout:10000});
 try{
  const result=await transport.sendMail({from:process.env.SMTP_FROM,to,subject,text,attachments:attachments.map(item=>({filename:String(item.filename||'ticket.pdf').slice(0,100),content:Buffer.from(item.base64||'','base64'),contentType:'application/pdf'}))});
  if(!result.accepted?.length)throw Error('Mail rejected');
  await pool.query("UPDATE notifications.deliveries SET status='accepted',accepted_at=NOW() WHERE id=$1",[id]);res.json({id,message:'Email service accepted the message for delivery.'});
 }catch{await pool.query("UPDATE notifications.deliveries SET status='failed' WHERE id=$1",[id]);throw failure(503,'Email delivery could not be confirmed.');}finally{transport.close();}
}));
start();
