const API=(import.meta.env?.VITE_API_URL||'').replace(/\/$/,'');
export async function accountRequest(path,body){
 const endpoint=path==='profile'?'/api/profiles/me':'/api/auth/'+path;
 const response=await fetch(API+endpoint,{method:body?'POST':'GET',credentials:'include',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
 const data=await response.json().catch(()=>({error:'Account service unavailable. Please try again.'}));
 if(!response.ok){const error=new Error(data.error||'Unable to continue. Please try again.');error.status=response.status;throw error;}
 if(path==='me'){try{const profile=await fetch(API+'/api/profiles/me',{credentials:'include',signal:AbortSignal.timeout(5000)});if(profile.ok)data.user=(await profile.json()).user;}catch{/* Authentication remains available when Profile is offline. */}}
 return data;
}
export function safeDestination(value){return /^\/ticket\/[a-f0-9-]{36}$/.test(value||'')||/^\/movie\/[1-9]\d*$/.test(value||'')||['/','/movies','/my-list','/bookings','/profile','/admin'].includes(value)?value:'/';}
export function readRoute(){return window.location.hash.slice(1)||'/';}

export function loginDestination(user,next='/'){const path=safeDestination(next);if(user?.role==='admin'&&path==='/')return '/admin';if(user?.role!=='admin'&&path==='/admin')return '/';return path;}
