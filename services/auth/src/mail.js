import nodemailer from 'nodemailer';
export const mailReady=()=>Boolean(process.env.SMTP_HOST&&process.env.SMTP_USER&&process.env.SMTP_PASSWORD&&process.env.SMTP_FROM);
export function accountLink(origin,screen,token){const url=new URL(origin);url.hash='/'+screen+'?token='+encodeURIComponent(token);return url.toString();}
export async function accountMail(to,subject,text){
 const port=Number(process.env.SMTP_PORT||587);
 const transport=nodemailer.createTransport({host:process.env.SMTP_HOST,port,secure:port===465,requireTLS:port!==465,auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD},connectionTimeout:5000,greetingTimeout:5000,socketTimeout:10000});
 try{const result=await transport.sendMail({from:process.env.SMTP_FROM,to,subject,text});if(!result.accepted?.length)throw Error('Mail not accepted');}finally{transport.close();}
}
