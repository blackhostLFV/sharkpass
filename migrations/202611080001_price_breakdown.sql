-- New quotes retain an immutable per-ticket price breakdown; no historical backfill.
CREATE TABLE ticket_type_pricing (
 type_id TEXT PRIMARY KEY REFERENCES ticket_types(id),
 base_cop INTEGER NOT NULL CHECK(base_cop>=0),
 vat_rate INTEGER NOT NULL CHECK(vat_rate BETWEEN 0 AND 100),
 vat_cop INTEGER NOT NULL CHECK(vat_cop>=0),
 total_cop INTEGER NOT NULL CHECK(total_cop=base_cop+vat_cop),
 CHECK(vat_cop=(base_cop*vat_rate+50)/100)
);
CREATE TABLE payment_pricing (
 payment_id TEXT PRIMARY KEY REFERENCES payment_attempts(id),
 base_cop INTEGER NOT NULL CHECK(base_cop>=0),
 vat_rate INTEGER NOT NULL CHECK(vat_rate BETWEEN 0 AND 100),
 vat_cop INTEGER NOT NULL CHECK(vat_cop>=0),
 total_cop INTEGER NOT NULL CHECK(total_cop=base_cop+vat_cop)
);
CREATE TRIGGER payment_pricing_no_update BEFORE UPDATE ON payment_pricing
BEGIN SELECT RAISE(ABORT,'Payment pricing snapshots are immutable'); END;
CREATE TRIGGER payment_pricing_no_delete BEFORE DELETE ON payment_pricing
BEGIN SELECT RAISE(ABORT,'Payment pricing snapshots are immutable'); END;
