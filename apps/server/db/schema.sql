CREATE TABLE d1_migrations(
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT UNIQUE,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
CREATE TABLE user (
    id TEXT NOT NULL PRIMARY KEY,
    username TEXT NOT NULL,
    email TEXT NOT NULL,
    email_verified BOOLEAN NOT NULL DEFAULT false,
    avatar TEXT NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);
CREATE TABLE account (
    id TEXT NOT NULL PRIMARY KEY,
    user_id TEXT NOT NULL,
    account_id TEXT,
    provider_id TEXT,
    access_token TEXT,
    access_token_expires_at DATETIME,
    refresh_token TEXT,
    refresh_token_expires_at DATETIME,
    scope TEXT,
    id_token TEXT,
    raw TEXT
);
CREATE TABLE session (
    id TEXT NOT NULL PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    ip TEXT,
    user_agent TEXT
);
CREATE TABLE email_verification_code (
    id TEXT NOT NULL PRIMARY KEY,
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    token TEXT NOT NULL,
    action TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at DATETIME NOT NULL
);
CREATE UNIQUE INDEX user_email_key ON user(email);