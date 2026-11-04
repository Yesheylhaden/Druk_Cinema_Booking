ALTER TABLE catalog.movies ALTER COLUMN year DROP NOT NULL;
ALTER TABLE catalog.movies ALTER COLUMN duration DROP NOT NULL;
ALTER TABLE catalog.movies ALTER COLUMN rating DROP NOT NULL;
ALTER TABLE catalog.movies ADD COLUMN IF NOT EXISTS is_new BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE catalog.movies ADD COLUMN IF NOT EXISTS listing_status TEXT NOT NULL DEFAULT 'now_showing';
INSERT INTO catalog.movies(id,title,year,genres,duration,rating,poster,description,is_new,listing_status) VALUES
(7,'Dorozam',NULL,ARRAY[]::TEXT[],NULL,NULL,'dorozam','Added from your poster collection. Release details, genre, and runtime are awaiting confirmation. Showtimes are sample demo screenings.',true,'now_showing'),
(8,'Naba Sho',NULL,ARRAY[]::TEXT[],NULL,NULL,'nabasho','Come Me Tomorrow. Added from your supplied poster. Release details and runtime are awaiting confirmation. Showtimes are sample demo screenings.',true,'now_showing'),
(9,'The Fearless',NULL,ARRAY[]::TEXT[],NULL,NULL,'fearless','Added from your supplied poster. Screening details are not yet scheduled in this demo.',true,'awaiting_schedule'),
(10,'Samsara',NULL,ARRAY[]::TEXT[],NULL,NULL,'samsara','A Bhutanese Tale. Added from your poster collection. Screening details are awaiting confirmation.',true,'awaiting_schedule'),
(11,'Title to be confirmed',NULL,ARRAY[]::TEXT[],NULL,NULL,'poster5','From your supplied 5.jpg poster. English title and screening details are awaiting confirmation.',true,'awaiting_schedule'),
(12,'Title to be confirmed',NULL,ARRAY[]::TEXT[],NULL,NULL,'poster13','From your supplied 13.jpg poster. English title and screening details are awaiting confirmation.',true,'awaiting_schedule')
ON CONFLICT(id) DO NOTHING;
