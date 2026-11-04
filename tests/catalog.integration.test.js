import test from 'node:test';
import assert from 'node:assert/strict';
test('poster additions are listed without invented metadata and pending films have no showtimes',{skip:process.env.RUN_INTEGRATION!=='1'},async()=>{
 const base=process.env.CATALOG_TEST_URL||'http://localhost:4001';
 const response=await fetch(base+'/api/movies');assert.equal(response.status,200);const movies=await response.json();
 assert.equal(movies.length,12);const added=movies.filter(movie=>movie.is_new);assert.equal(added.length,6);
 for(const title of ['Dorozam','Naba Sho','The Fearless','Samsara'])assert.ok(added.some(movie=>movie.title===title));
 assert.equal(added.filter(movie=>movie.title==='Title to be confirmed').length,2);
 for(const movie of added){assert.equal(movie.rating,null);assert.equal(movie.duration,null);assert.equal(movie.year,null);}
 for(const movie of added){const shows=await(await fetch(base+'/api/showtimes?movieId='+movie.id)).json();if(movie.listing_status==='awaiting_schedule')assert.deepEqual(shows,[]);else{assert.ok(shows.length);assert.deepEqual([...new Set(shows.map(show=>show.theatre_id))].sort(),[1,2]);}}
});
