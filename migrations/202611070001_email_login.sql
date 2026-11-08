CREATE TABLE login_emails(user_id TEXT PRIMARY KEY REFERENCES users(id),email TEXT NOT NULL COLLATE NOCASE UNIQUE);
INSERT INTO login_emails(user_id,email) SELECT user_id,lower(email) FROM account_emails;
