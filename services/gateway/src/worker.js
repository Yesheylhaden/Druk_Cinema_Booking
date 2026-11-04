export default {async fetch(request,env){
 const origin=request.headers.get('Origin');
 if(origin&&origin!==env.FRONTEND_ORIGIN)return new Response('Origin not allowed',{status:403});
 const headers={'Access-Control-Allow-Origin':env.FRONTEND_ORIGIN,'Access-Control-Allow-Credentials':'true','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Vary':'Origin','Cache-Control':'no-store'};
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 const url=new URL(request.url),catalog=/^\/api\/(movies|showtimes)$/.test(url.pathname),booking=/^\/api\/bookings(?:\/(?:seats|mine|options|payment\/otp|[a-f0-9-]{36}\/(?:cancel|ticket|email)))?$/.test(url.pathname),auth=/^\/api\/auth\/(login|register|logout|me|profile|password|password\/forgot|password\/reset|verification\/request|verification\/confirm|email\/change)$/.test(url.pathname);
 if(!catalog&&!booking&&!auth)return Response.json({error:'Not found'},{status:404,headers});
 const allowed=request.method==='GET'&&(catalog||(/\/(?:seats|mine|options|ticket)$/.test(url.pathname))||['/api/auth/me','/api/auth/profile'].includes(url.pathname))||request.method==='POST'&&(url.pathname==='/api/bookings'||booking&&/\/(?:cancel|email|otp)$/.test(url.pathname)||auth&&!url.pathname.endsWith('/me'));
 if(!allowed)return Response.json({error:'Method not allowed'},{status:405,headers});
 try{
 const forwarded=new Headers();
 for(const name of ['Content-Type','Cookie','Origin','Sec-Fetch-Site']){const value=request.headers.get(name);if(value)forwarded.set(name,value);}
 const response=await fetch(new URL(url.pathname+url.search,catalog?env.CATALOG_URL:auth?env.AUTH_URL:env.BOOKINGS_URL),{method:request.method,headers:forwarded,body:request.method==='POST'?request.body:undefined,signal:AbortSignal.timeout(25000)});
 const outgoing=new Headers(response.headers);Object.entries(headers).forEach(([key,value])=>outgoing.set(key,value));
 return new Response(response.body,{status:response.status,headers:outgoing});
 }catch{return Response.json({error:'Service unavailable'},{status:503,headers});}
}};
