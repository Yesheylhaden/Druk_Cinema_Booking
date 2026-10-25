CREATE SCHEMA catalog;
CREATE SCHEMA booking;
CREATE TABLE catalog.movies(id INTEGER PRIMARY KEY,title TEXT NOT NULL,year INTEGER NOT NULL,genres TEXT[] NOT NULL,duration INTEGER NOT NULL,rating NUMERIC(2,1) NOT NULL,poster TEXT NOT NULL,description TEXT NOT NULL);
INSERT INTO catalog.movies VALUES
(1,'Lekzin',2024,ARRAY['Drama','Thriller'],126,4.9,'mountains','Four lives. One secret. A story of family, loyalty, and finding the way home.'),
(2,'Azai Dhrey',2023,ARRAY['Comedy'],113,4.7,'city','An unexpected encounter turns an ordinary day into a beautifully chaotic adventure.'),
(3,'Chasing Stars',2025,ARRAY['Romance','Drama'],108,4.8,'flowers','Two dreamers discover that the best journeys are shared.'),
(4,'The Return',2024,ARRAY['Action','Thriller'],118,4.5,'temple','A prince returns to a divided kingdom, where old loyalties face a new test.'),
(5,'Phushay',2023,ARRAY['Comedy','Romance'],109,4.6,'valley','A little misunderstanding. A big-hearted romance. A night to remember.'),
(6,'Ama',2025,ARRAY['Drama'],102,4.8,'home','A portrait of motherhood and the quiet courage that holds a family together.');
CREATE TABLE catalog.showtimes(id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,movie_id INTEGER REFERENCES catalog.movies(id),starts_at TIMESTAMPTZ NOT NULL,auditorium TEXT NOT NULL,price NUMERIC(10,2) NOT NULL CHECK(price>0));
INSERT INTO catalog.showtimes(movie_id,starts_at,auditorium,price) SELECT m.id,date_trunc('day',NOW())+d*INTERVAL '1 day'+h*INTERVAL '1 hour','Thimphu · Hall 1',350 FROM catalog.movies m CROSS JOIN generate_series(1,14) d CROSS JOIN unnest(ARRAY[8,12,15]) h;
CREATE TABLE booking.reservations(id UUID PRIMARY KEY,showtime_id INTEGER NOT NULL,name TEXT NOT NULL,email TEXT NOT NULL,total NUMERIC(10,2) NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE booking.seats(showtime_id INTEGER NOT NULL,seat TEXT NOT NULL CHECK(seat ~ '^[A-F]([1-9]|10)$'),reservation_id UUID NOT NULL REFERENCES booking.reservations(id),PRIMARY KEY(showtime_id,seat));
