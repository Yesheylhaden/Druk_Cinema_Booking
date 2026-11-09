import pg from 'pg';
import {readFile} from 'node:fs/promises';
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL}),client=await pool.connect();
const read=path=>readFile(new URL(path,import.meta.url),'utf8');
try{
 await client.query('BEGIN');await client.query("SELECT pg_advisory_xact_lock(20261106)");
 // Admin-only bootstrap: legacy schemas are retained as migration archives.
 await client.query(await read('../../auth/src/schema.sql'));
 await client.query(await read('../../bookings/src/schema.sql'));
 await client.query(await read('../../catalog/src/movies.sql'));
 await client.query(await read('../../catalog/src/theatres.sql'));
 await client.query(await read('./schema.sql'));
 const applied=(await client.query("SELECT 1 FROM infrastructure.migrations WHERE id='independent-services-v1'")).rows.length;
 if(!applied){
  await client.query(`INSERT INTO profiles.users(user_id,name,phone,created_at) SELECT id,name,phone,created_at FROM identity.users ON CONFLICT DO NOTHING;
  INSERT INTO movies.movies SELECT * FROM catalog.movies ON CONFLICT DO NOTHING;
  INSERT INTO cinemas.cinemas(id,name,city) SELECT id,name,city FROM catalog.theatres ON CONFLICT DO NOTHING;
  INSERT INTO halls.halls(id,cinema_id,name) SELECT id,id,'Hall 1' FROM catalog.theatres ON CONFLICT DO NOTHING;
  INSERT INTO seats.seats SELECT h.id,chr(64+r)||c,chr(64+r),c FROM halls.halls h CROSS JOIN generate_series(1,6) r CROSS JOIN generate_series(1,10) c ON CONFLICT DO NOTHING;
  INSERT INTO showtimes.slots(id,movie_id,theatre_id,hall_id,starts_at,auditorium,price,theatre_name,city) SELECT s.id,s.movie_id,s.theatre_id,s.theatre_id,s.starts_at,s.auditorium,s.price,t.name,t.city FROM catalog.showtimes s JOIN catalog.theatres t ON t.id=s.theatre_id ON CONFLICT DO NOTHING;
  SELECT setval(pg_get_serial_sequence('showtimes.slots','id'),GREATEST(COALESCE((SELECT MAX(id) FROM showtimes.slots),1),1));
  INSERT INTO reservations.seats SELECT s.showtime_id,s.seat,s.reservation_id,b.user_id FROM booking.seats s LEFT JOIN booking.reservations b ON b.id=s.reservation_id ON CONFLICT DO NOTHING;
  INSERT INTO payments.demo_otps SELECT * FROM booking.demo_otps ON CONFLICT DO NOTHING;
  INSERT INTO payments.otp_limits SELECT * FROM booking.otp_limits ON CONFLICT DO NOTHING;
  INSERT INTO tickets.records(booking_id,created_at,email_attempts,email_requested_at,emailed_at) SELECT id,created_at,email_attempts,email_requested_at,emailed_at FROM booking.reservations ON CONFLICT DO NOTHING;
  INSERT INTO infrastructure.migrations(id) VALUES('independent-services-v1');`);
 }
 const grants={auth:['identity'],profiles:['profiles'],movies:['movies'],cinemas:['cinemas'],showtimes:['showtimes'],halls:['halls'],seats:['seats'],reservations:['reservations'],payments:['payments'],tickets:['tickets'],notifications:['notifications'],search:['search'],bookings:['booking']};
 for(const [name,schemas] of Object.entries(grants)){
  const role=name+'_runtime';
  if(!(await client.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rows.length)await client.query('CREATE ROLE '+role+' LOGIN');
  const formatted=(await client.query("SELECT format('ALTER ROLE %I PASSWORD %L',$1::text,$2::text) AS sql",[role,(process.env[name.toUpperCase()+'_DB_PASSWORD']||process.env.POSTGRES_PASSWORD)])).rows[0].sql;await client.query(formatted);
  for(const schema of schemas){
   await client.query('GRANT USAGE ON SCHEMA '+schema+' TO '+role);
   if(name==='bookings')await client.query('GRANT SELECT,INSERT,UPDATE,DELETE ON booking.reservations TO '+role);
   else await client.query('GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA '+schema+' TO '+role);
   await client.query('GRANT USAGE,SELECT,UPDATE ON ALL SEQUENCES IN SCHEMA '+schema+' TO '+role);
  }
 }
 await client.query('COMMIT');console.log('Independent service schemas migrated. Existing records preserved.');
}catch(error){await client.query('ROLLBACK');console.error('Service migration failed: '+error.message);process.exitCode=1;}finally{client.release();await pool.end();}
