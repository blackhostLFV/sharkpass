CREATE TABLE account_emails(user_id TEXT PRIMARY KEY REFERENCES users(id),email TEXT NOT NULL UNIQUE,verified_at INTEGER NOT NULL);
CREATE TABLE account_tokens(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),purpose TEXT NOT NULL CHECK(purpose IN ('verify','reset')),email TEXT NOT NULL,expires_at INTEGER NOT NULL);
CREATE INDEX account_tokens_expiry ON account_tokens(expires_at);
