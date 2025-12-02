CREATE TABLE d1_migrations(
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT UNIQUE,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
CREATE TABLE vault (
    id TEXT NOT NULL PRIMARY KEY,
    user_id TEXT NOT NULL,
    public_key TEXT NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);