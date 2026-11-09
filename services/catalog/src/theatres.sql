CREATE TABLE IF NOT EXISTS catalog.theatres(id INTEGER PRIMARY KEY,name TEXT NOT NULL,city TEXT NOT NULL);
INSERT INTO catalog.theatres(id,name,city) VALUES(1,'Cinema Hall','Thimphu'),(2,'Lugar Theater','Thimphu') ON CONFLICT(id) DO NOTHING;
ALTER TABLE catalog.showtimes ADD COLUMN IF NOT EXISTS theatre_id INTEGER NOT NULL DEFAULT 1 REFERENCES catalog.theatres(id);
UPDATE catalog.showtimes SET auditorium='Cinema Hall · Thimphu · Hall 1' WHERE theatre_id=1 AND auditorium='Thimphu · Hall 1';
CREATE UNIQUE INDEX IF NOT EXISTS showtime_theatre_slot ON catalog.showtimes(movie_id,theatre_id,starts_at);
-- Sample schedules for the local demo, not live cinema timetables.
-- Keep existing schedules on a day intact and fill missing demo days idempotently.
INSERT INTO catalog.showtimes(movie_id,starts_at,auditorium,price,theatre_id)
SELECT m.id,(d.day+s.clock) AT TIME ZONE 'Asia/Thimphu',t.name||' · '||t.city||' · Hall 1',350,t.id
FROM catalog.movies m
CROSS JOIN catalog.theatres t
CROSS JOIN LATERAL (SELECT ((NOW() AT TIME ZONE 'Asia/Thimphu')::date+n)::date AS day FROM generate_series(0,13) n) d
CROSS JOIN LATERAL (SELECT unnest(CASE WHEN t.id=1 THEN ARRAY[TIME '10:30',TIME '13:45',TIME '17:30',TIME '20:00'] ELSE ARRAY[TIME '09:00',TIME '12:00',TIME '15:00',TIME '18:00'] END) AS clock) s
WHERE m.listing_status='now_showing' AND NOT EXISTS(SELECT 1 FROM catalog.showtimes existing WHERE existing.movie_id=m.id AND existing.theatre_id=t.id AND (existing.starts_at AT TIME ZONE 'Asia/Thimphu')::date=d.day)
ON CONFLICT(movie_id,theatre_id,starts_at) DO NOTHING;
