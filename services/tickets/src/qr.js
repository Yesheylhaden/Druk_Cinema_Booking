import QRCode from 'qrcode';
export function ticketUrl(reference,base=process.env.PUBLIC_APP_URL||process.env.FRONTEND_ORIGIN||'http://localhost:5173'){
 const url=new URL(base);
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw new Error('PUBLIC_APP_URL must be an HTTP or HTTPS website URL.');
 url.search='';url.hash='/ticket/'+encodeURIComponent(reference);return url.href;
}
export async function ticketQr(reference){
 const url=ticketUrl(reference);
 const image=await QRCode.toDataURL(url,{errorCorrectionLevel:'M',margin:4,width:320});
 return {url,image};
}
