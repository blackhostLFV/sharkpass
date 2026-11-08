CREATE TABLE payment_attempts(
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id),
 event_id TEXT NOT NULL REFERENCES events(id),
 type_id TEXT NOT NULL REFERENCES ticket_types(id),
 quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 6),
 amount_cents INTEGER NOT NULL CHECK(amount_cents>0),
 email TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('pending','confirmed','failed','expired','review','voided')),
 environment TEXT NOT NULL CHECK(environment IN ('test','prod')),
 provider_id TEXT UNIQUE,
 order_id TEXT REFERENCES orders(id),
 idempotency_key TEXT NOT NULL,
 request_hash TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL,
 UNIQUE(user_id,idempotency_key)
);
CREATE INDEX payment_capacity ON payment_attempts(type_id,state,expires_at);
CREATE TABLE mail_outbox(
 id TEXT PRIMARY KEY,
 payment_id TEXT NOT NULL UNIQUE REFERENCES payment_attempts(id),
 state TEXT NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','sending','sent','attention')),
 attempts INTEGER NOT NULL DEFAULT 0,
 next_at INTEGER NOT NULL,
 first_attempt_at INTEGER,
 provider_id TEXT,
 sent_at INTEGER
);
