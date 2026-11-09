import test from 'node:test';
import assert from 'node:assert/strict';
import {ticketPdf} from '../services/tickets/src/pdf.js';
import {emailEnabled} from '../services/notifications/src/config.js';
test('generates a real PDF reservation ticket',async()=>{
 const pdf=await ticketPdf({id:'cfe109cf-4a7c-4ed8-9da7-6afcc111039e',movie_title:'Lekzin',name:'Pema Dorji',starts_at:'2027-01-01T12:00:00Z',auditorium:'Thimphu Hall 1',booked_seats:['A1','A2'],total:'700',payment_status:'paid'});
 assert.equal(pdf.subarray(0,5).toString(),'%PDF-');assert.ok(pdf.length>1000);assert.match(pdf.subarray(-30).toString(),/%%EOF/);
});
test('SMTP delivery availability requires complete configuration',()=>{
 const names=['SMTP_HOST','SMTP_FROM','SMTP_USER','SMTP_PASSWORD'],previous=names.map(name=>process.env[name]);
 try{names.forEach(name=>delete process.env[name]);assert.equal(emailEnabled(),false);names.forEach(name=>process.env[name]='configured');assert.equal(emailEnabled(),true);delete process.env.SMTP_PASSWORD;assert.equal(emailEnabled(),false);}finally{names.forEach((name,i)=>{if(previous[i]===undefined)delete process.env[name];else process.env[name]=previous[i];});}
});
test('does not generate unpaid tickets',async()=>{await assert.rejects(ticketPdf({payment_status:'unpaid'}),/Verified payment/);});

test('generates a sample ticket for a separately marked demo payment',async()=>{const pdf=await ticketPdf({id:'demo-reference',movie_title:'Demo movie',name:'Demo guest',starts_at:'2027-01-01T12:00:00Z',auditorium:'Demo Hall',booked_seats:['A1'],total:350,payment_status:'demo_paid'});assert.equal(pdf.subarray(0,5).toString(),'%PDF-');});

import {ticketQr,ticketUrl} from '../services/tickets/src/qr.js';
import {PNG} from 'pngjs';
import jsQR from 'jsqr';
import {safeDestination} from '../frontend/src/auth.js';
test('ticket QR decodes to its authenticated ticket page',async()=>{
 const reference='cfe109cf-4a7c-4ed8-9da7-6afcc111039e',qr=await ticketQr(reference);
 const png=PNG.sync.read(Buffer.from(qr.image.split(',')[1],'base64'));
 const decoded=jsQR(new Uint8ClampedArray(png.data),png.width,png.height);
 assert.ok(decoded);assert.equal(decoded.data,qr.url);assert.equal(new URL(decoded.data).hash,'#/ticket/'+reference);
 assert.equal(safeDestination('/ticket/'+reference),'/ticket/'+reference);
 assert.equal(safeDestination('https://evil.example'),'/');
 assert.equal(ticketUrl(reference,'https://cinema.example/app/'),'https://cinema.example/app/#/ticket/'+reference);
 assert.throws(()=>ticketUrl(reference,'javascript:alert(1)'),/HTTP/);
});
