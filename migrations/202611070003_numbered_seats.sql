CREATE TABLE ticket_type_visibility(type_id TEXT PRIMARY KEY REFERENCES ticket_types(id),visibility TEXT NOT NULL CHECK(visibility IN ('public','internal')));
CREATE TABLE event_seats(id TEXT PRIMARY KEY,event_id TEXT NOT NULL REFERENCES events(id),type_id TEXT NOT NULL REFERENCES ticket_types(id),row_label TEXT NOT NULL,seat_number INTEGER NOT NULL CHECK(seat_number BETWEEN 1 AND 1000),UNIQUE(event_id,row_label,seat_number));
CREATE INDEX event_seats_type ON event_seats(type_id);
CREATE TABLE seat_allocations(seat_id TEXT PRIMARY KEY REFERENCES event_seats(id),payment_id TEXT REFERENCES payment_attempts(id),ticket_id TEXT UNIQUE REFERENCES tickets(id),expires_at INTEGER,CHECK(payment_id IS NOT NULL OR ticket_id IS NOT NULL));
CREATE INDEX seat_allocations_payment ON seat_allocations(payment_id);
CREATE TABLE ticket_seats(ticket_id TEXT PRIMARY KEY REFERENCES tickets(id),seat_id TEXT NOT NULL REFERENCES event_seats(id));
