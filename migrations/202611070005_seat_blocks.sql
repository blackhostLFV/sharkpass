CREATE TABLE seat_blocks (
  seat_id TEXT PRIMARY KEY REFERENCES event_seats(id),
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TRIGGER no_allocate_blocked_seat BEFORE INSERT ON seat_allocations
WHEN EXISTS (SELECT 1 FROM seat_blocks WHERE seat_id=NEW.seat_id)
BEGIN SELECT RAISE(ABORT,'Seat is blocked'); END;
CREATE TRIGGER no_block_allocated_seat BEFORE INSERT ON seat_blocks
WHEN EXISTS (SELECT 1 FROM seat_allocations WHERE seat_id=NEW.seat_id)
BEGIN SELECT RAISE(ABORT,'Seat is allocated'); END;
