CREATE TABLE event_presentation(
  event_id TEXT PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  image TEXT,
  category TEXT NOT NULL DEFAULT 'Eventos'
);
