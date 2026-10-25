import test from 'node:test';
import assert from 'node:assert/strict';
const enabled=process.env.RUN_INTEGRATION==='1';
const catalog=process.env.CATALOG_TEST_URL||'http://localhost:4001',bookings=process.env.BOOKINGS_TEST_URL||'http://localhost:4002';
async function ready(origin){for(let attempt=0;attempt<30;attempt++){try{const r=await fetch(origin+'/health',{signal:AbortSignal.timeout(2000)});if(r.ok)return;}catch{}await new Promise(r=>setTimeout(r,1000));}throw Error(origin+' did not become healthy');}
test('database-backed reservation prevents concurrent double booking',{skip:!enabled},async()=>{
 await Promise.all([ready(catalog),ready(bookings)]);
 const movies=await (await fetch(catalog+'/api/movies')).json();assert.ok(movies.length);
 const shows=await (await fetch(catalog+'/api/showtimes?movieId='+movies[0].id)).json();assert.ok(shows.length);
 const show=shows[0],reserved=await (await fetch(bookings+'/api/bookings/seats?showtimeId='+show.id)).json();
 const seat=Array.from({length:60},(_,i)=>'ABCDEF'[Math.floor(i/10)]+(i%10+1)).find(s=>!reserved.includes(s));assert.ok(seat);
 const send=()=>fetch(bookings+'/api/bookings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({movieId:movies[0].id,showtimeId:show.id,seats:[seat],name:'Integration Test',email:'integration@example.com',total:1})});
 const responses=await Promise.all([send(),send()]);
 assert.deepEqual(responses.map(r=>r.status).sort(),[201,409]);
 const confirmation=await responses.find(r=>r.status===201).json();
 assert.equal(confirmation.total,Number(show.price));assert.ok(confirmation.reference);
 assert.ok((await(await fetch(bookings+'/api/bookings/seats?showtimeId='+show.id)).json()).includes(seat));
});