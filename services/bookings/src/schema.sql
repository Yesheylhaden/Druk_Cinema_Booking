ALTER TABLE booking.reservations ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE booking.reservations ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'confirmed';
ALTER TABLE booking.reservations ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid';
ALTER TABLE booking.reservations ADD COLUMN IF NOT EXISTS movie_title TEXT;
ALTER TABLE booking.reservations ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ;
ALTER TABLE booking.reservations ADD COLUMN IF NOT EXISTS auditorium TEXT;
ALTER TABLE booking.reservations ADD COLUMN IF NOT EXISTS booked_seats TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE booking.reservations ADD COLUMN IF NOT EXISTS request_key UUID;
ALTER TABLE booking.reservations ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE booking.reservations ADD COLUMN IF NOT EXISTS emailed_at TIMESTAMPTZ;
ALTER TABLE booking.reservations ADD COLUMN IF NOT EXISTS email_requested_at TIMESTAMPTZ;
ALTER TABLE booking.reservations ADD COLUMN IF NOT EXISTS email_attempts INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS reservation_request_key ON booking.reservations(user_id,request_key);
UPDATE booking.reservations r SET booked_seats=s.seats FROM (SELECT reservation_id,array_agg(seat ORDER BY seat) AS seats FROM booking.seats GROUP BY reservation_id) s WHERE r.id=s.reservation_id AND cardinality(r.booked_seats)=0;
CREATE INDEX IF NOT EXISTS reservations_user_created ON booking.reservations(user_id,created_at DESC);

ALTER TABLE booking.reservations ADD COLUMN IF NOT EXISTS payment_reference TEXT;

CREATE TABLE IF NOT EXISTS booking.demo_otps (
 user_id UUID NOT NULL,
 request_id UUID NOT NULL,
 selection_hash CHAR(64) NOT NULL,
 code_hash CHAR(64) NOT NULL,
 salt CHAR(32) NOT NULL,
 expires_at TIMESTAMPTZ NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0,
 consumed_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 PRIMARY KEY(user_id,request_id)
);
CREATE TABLE IF NOT EXISTS booking.otp_limits(user_id UUID PRIMARY KEY,hits INTEGER NOT NULL,resets_at TIMESTAMPTZ NOT NULL);