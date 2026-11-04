CREATE SCHEMA IF NOT EXISTS identity;
CREATE TABLE IF NOT EXISTS identity.users (
 id UUID PRIMARY KEY,
 name VARCHAR(100) NOT NULL,
 email VARCHAR(254) NOT NULL UNIQUE,
 password_hash TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS identity.sessions (
 token_hash CHAR(64) PRIMARY KEY,
 user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
 expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expiry ON identity.sessions(expires_at);
CREATE TABLE IF NOT EXISTS identity.rate_limits (
 key CHAR(64) PRIMARY KEY,
 hits INTEGER NOT NULL,
 resets_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE identity.users ADD COLUMN IF NOT EXISTS phone VARCHAR(30) NOT NULL DEFAULT '';
ALTER TABLE identity.users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE identity.users ADD COLUMN IF NOT EXISTS credential_version INTEGER NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS identity.action_tokens (
 token_hash CHAR(64) PRIMARY KEY,
 user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
 purpose TEXT NOT NULL CHECK(purpose IN ('verify','reset','change-email')),
 email VARCHAR(254) NOT NULL,
 credential_version INTEGER NOT NULL,
 expires_at TIMESTAMPTZ NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS action_tokens_user ON identity.action_tokens(user_id,purpose);