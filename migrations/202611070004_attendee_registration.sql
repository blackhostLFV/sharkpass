CREATE TABLE event_sale_rules(event_id TEXT PRIMARY KEY REFERENCES events(id),require_attendees INTEGER NOT NULL CHECK(require_attendees IN (0,1)),terms_version TEXT NOT NULL,terms_json TEXT NOT NULL);
CREATE TABLE payment_registrations(payment_id TEXT PRIMARY KEY REFERENCES payment_attempts(id),attendees_json TEXT NOT NULL,terms_version TEXT NOT NULL,accepted_at INTEGER NOT NULL);
CREATE TABLE ticket_attendees(ticket_id TEXT PRIMARY KEY REFERENCES tickets(id),full_name TEXT NOT NULL CHECK(length(full_name) BETWEEN 2 AND 120));
