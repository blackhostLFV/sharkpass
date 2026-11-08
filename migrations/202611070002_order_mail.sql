CREATE TABLE purchase_mail_outbox(
 id TEXT PRIMARY KEY,
 payment_id TEXT UNIQUE REFERENCES payment_attempts(id),
 order_id TEXT UNIQUE REFERENCES orders(id),
 email TEXT,
 state TEXT NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','sending','sent','attention')),
 attempts INTEGER NOT NULL DEFAULT 0,
 next_at INTEGER NOT NULL,
 first_attempt_at INTEGER,
 provider_id TEXT,
 sent_at INTEGER,
 CHECK(payment_id IS NOT NULL OR (order_id IS NOT NULL AND email IS NOT NULL))
);
INSERT INTO purchase_mail_outbox(id,payment_id,state,attempts,next_at,first_attempt_at,provider_id,sent_at)
 SELECT id,payment_id,state,attempts,next_at,first_attempt_at,provider_id,sent_at FROM mail_outbox;
DROP TABLE mail_outbox;
ALTER TABLE purchase_mail_outbox RENAME TO mail_outbox;
