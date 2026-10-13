CREATE TABLE IF NOT EXISTS rooms (
  id integer PRIMARY KEY,
  name text NOT NULL UNIQUE,
  capacity integer NOT NULL CHECK (capacity > 0),
  floor integer NOT NULL,
  amenities text[] NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS bookings (
  id serial PRIMARY KEY,
  room_id integer NOT NULL REFERENCES rooms(id),
  title varchar(100) NOT NULL CHECK (length(btrim(title)) > 0),
  organizer_email varchar(254) NOT NULL,
  attendees integer NOT NULL CHECK (attendees >= 1),
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL CHECK (end_at > start_at),
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bookings_room_time ON bookings(room_id, start_at, end_at) WHERE status = 'confirmed';
CREATE INDEX IF NOT EXISTS bookings_organizer_day ON bookings(organizer_email, start_at) WHERE status = 'confirmed';
INSERT INTO rooms (id, name, capacity, floor, amenities) VALUES
  (1, 'Atlas', 4, 1, ARRAY['monitor']),
  (2, 'Borealis', 8, 1, ARRAY['projector', 'whiteboard']),
  (3, 'Cascade', 12, 2, ARRAY['projector', 'video-conferencing']),
  (4, 'Delta', 20, 3, ARRAY['projector', 'video-conferencing', 'whiteboard']),
  (5, 'Ember', 2, 2, ARRAY[]::text[])
ON CONFLICT (id) DO NOTHING;
