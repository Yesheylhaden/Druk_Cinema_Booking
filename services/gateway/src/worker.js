import {resolveRoute} from './routes.js';
export default {async fetch(request,env){
 const origin=request.headers.get('Origin');
 if(origin&&origin!==env.FRONTEND_ORIGIN)return new Response('Origin not allowed',{status:403});
 const headers={'Access-Control-Allow-Origin':env.FRONTEND_ORIGIN,'Access-Control-Allow-Credentials':'true','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type',Vary:'Origin','Cache-Control':'no-store'};
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 const url=new URL(request.url),route=resolveRoute(url.pathname,request.method);
 if(route.status)return Response.json({error:route.status===405?'Method not allowed':'Not found'},{status:route.status,headers});
 const base=env[route.service.toUpperCase()+'_URL'];if(!base)return Response.json({error:'Service origin is not configured.'},{status:503,headers});
 try{
  const forwarded=new Headers();for(const name of ['Content-Type','Cookie','Origin','Sec-Fetch-Site']){const value=request.headers.get(name);if(value)forwarded.set(name,value);}
  const result=await fetch(new URL(route.path+url.search,base),{method:request.method,headers:forwarded,body:request.method==='POST'?request.body:undefined,signal:AbortSignal.timeout(25000)});
  const outgoing=new Headers(result.headers);Object.entries(headers).forEach(([key,value])=>outgoing.set(key,value));return new Response(result.body,{status:result.status,headers:outgoing});
 }catch{return Response.json({error:'Service unavailable'},{status:503,headers});}
}};
