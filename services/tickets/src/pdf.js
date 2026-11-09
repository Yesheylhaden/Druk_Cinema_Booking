import PDFDocument from 'pdfkit';
import {ticketQr} from './qr.js';
export async function ticketPdf(booking){
 if(!['paid','demo_paid'].includes(booking.payment_status))return Promise.reject(new Error('Verified payment is required to issue a ticket.'));
 const qr=await ticketQr(booking.id);
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
  if(doc.y>420)doc.addPage();
  const qrY=doc.y+12;doc.image(Buffer.from(qr.image.split(',')[1],'base64'),36,qrY,{width:120,height:120});
  doc.fontSize(9).fillColor('#151515').text('Scan to view your ticket. Sign in with the booking account.',170,qrY+25,{width:205});
  doc.text('Open ticket online',170,qrY+70,{width:205,link:qr.url,underline:true});
  doc.end();
 });
}
