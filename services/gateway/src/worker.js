export default {async fetch(request,env){
 const origin=request.headers.get('Origin');
 if(origin&&origin!==env.FRONTEND_ORIGIN)return new Response('Origin not allowed',{status:403});
 const headers={'Access-Control-Allow-Origin':env.FRONTEND_ORIGIN,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Vary':'Origin','Cache-Control':'no-store'};
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 const url=new URL(request.url),catalog=/^\/api\/(movies|showtimes)$/.test(url.pathname),booking=/^\/api\/bookings(?:\/seats)?$/.test(url.pathname);
 if(!catalog&&!booking)return Response.json({error:'Not found'},{status:404,headers});
 if(!(request.method==='GET'&&(catalog||url.pathname.endsWith('/seats'))||request.method==='POST'&&url.pathname==='/api/bookings'))return Response.json({error:'Method not allowed'},{status:405,headers});
 try{const response=await fetch(new URL(url.pathname+url.search,catalog?env.CATALOG_URL:env.BOOKINGS_URL),{method:request.method,headers:{'Content-Type':'application/json'},body:request.method==='POST'?request.body:undefined,signal:AbortSignal.timeout(10000)});
 return new Response(response.body,{status:response.status,headers:{...headers,'Content-Type':'application/json'}});
 }catch{return Response.json({error:'Service unavailable'},{status:503,headers});}
}};