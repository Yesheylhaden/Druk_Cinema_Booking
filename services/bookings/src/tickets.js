import PDFDocument from 'pdfkit';
import nodemailer from 'nodemailer';
export const emailEnabled=()=>Boolean(process.env.SMTP_HOST&&process.env.SMTP_FROM&&process.env.SMTP_USER&&process.env.SMTP_PASSWORD);
export function ticketPdf(booking){
 if(!['paid','demo_paid'].includes(booking.payment_status))return Promise.reject(new Error('Verified payment is required to issue a ticket.'));
 return new Promise((resolve,reject)=>{
  const doc=new PDFDocument({size:'A5',margin:36}),chunks=[];
  doc.on('data',chunk=>chunks.push(chunk));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);
  doc.fontSize(11).fillColor('#936c22').text('DRUK CINEMA', {characterSpacing:3});
  doc.moveDown().fontSize(24).fillColor('#151515').text(booking.movie_title||'Movie reservation');
  doc.moveDown(.6).fontSize(11).text(booking.payment_status==='demo_paid'?'DEMO TICKET - NOT VALID FOR ADMISSION':'RESERVATION TICKET');
  doc.moveDown().fontSize(12).text('Guest: '+booking.name);
  doc.moveDown(.5).text('Showtime: '+(booking.starts_at?new Date(booking.starts_at).toLocaleString('en-GB',{timeZone:'Asia/Thimphu'}):'Contact the cinema')+' (Bhutan time)');
  doc.moveDown(.5).text('Cinema: '+(booking.auditorium||'Druk Cinema'));
  doc.moveDown(.5).text('Seats: '+booking.booked_seats.join(', '));
  doc.moveDown(.5).text('Total: Nu. '+Number(booking.total).toFixed(2));
  doc.moveDown(.5).text('Payment: '+(booking.payment_status==='demo_paid'?'SIMULATED - NO MONEY CHARGED':booking.payment_status==='paid'?'Paid':'Unpaid - ticket not valid'));
  doc.moveDown().fontSize(10).text('Reference: '+booking.id);
  doc.moveDown().fontSize(9).fillColor('#555555').text('Bring this ticket and your confirmation reference. This reservation is valid only while active. A reservation is not proof of payment.');
  doc.end();
 });
}
export async function sendTicket(booking,pdf){
 const port=Number(process.env.SMTP_PORT||587);
 const transport=nodemailer.createTransport({host:process.env.SMTP_HOST,port,secure:port===465,requireTLS:port!==465,auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD},connectionTimeout:5000,greetingTimeout:5000,socketTimeout:10000});
 try{
  const result=await transport.sendMail({from:process.env.SMTP_FROM,to:booking.email,subject:'Your Druk Cinema reservation ticket',text:'Your reservation for '+booking.movie_title+' is attached. Reference: '+booking.id+'. Payment has been verified. Booked tickets cannot be cancelled.',attachments:[{filename:'druk-cinema-'+booking.id+'.pdf',content:pdf,contentType:'application/pdf'}]});
  if(!result.accepted?.length)throw Error('Mail not accepted');
 }finally{transport.close();}
}

export async function sendPaymentOtp(email,code,total){
 const port=Number(process.env.SMTP_PORT||587);
 const transport=nodemailer.createTransport({host:process.env.SMTP_HOST,port,secure:port===465,requireTLS:port!==465,auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD},connectionTimeout:5000,greetingTimeout:5000,socketTimeout:10000});
 try{const result=await transport.sendMail({from:process.env.SMTP_FROM,to:email,subject:'Druk Cinema DEMO payment code',text:'Your demo checkout code is '+code+'. It expires in 5 minutes. Simulated total: Nu. '+total+'. No money will be charged. This is not a Bank of Bhutan OTP. Enter it only on your Druk Cinema demo checkout. If you did not request this, ignore it.'});if(!result.accepted?.length)throw Error('Mail not accepted');}finally{transport.close();}
}