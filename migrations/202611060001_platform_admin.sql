CREATE TABLE platform_admins(user_id TEXT PRIMARY KEY REFERENCES users(id),granted_at TEXT NOT NULL,operator TEXT NOT NULL);
CREATE TABLE platform_admin_setup(singleton INTEGER PRIMARY KEY CHECK(singleton=1),user_id TEXT NOT NULL REFERENCES users(id),consumed_at TEXT NOT NULL);
CREATE TABLE platform_admin_audit(id TEXT PRIMARY KEY,actor_id TEXT REFERENCES users(id),operator TEXT NOT NULL,action TEXT NOT NULL,target_id TEXT,reason TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE INDEX platform_admin_audit_time ON platform_admin_audit(created_at);
