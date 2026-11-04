import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const databasePath = resolve(process.cwd(), process.env.DATABASE_PATH ?? "data/awardify.sqlite");
mkdirSync(dirname(databasePath), { recursive: true });

const database = new Database(databasePath, { timeout: 5000 });
database.pragma("journal_mode = WAL");
database.pragma("foreign_keys = ON");
database.exec(`
	CREATE TABLE IF NOT EXISTS users (
		id INTEGER PRIMARY KEY,
		email TEXT NOT NULL COLLATE NOCASE UNIQUE,
		password_hash TEXT NOT NULL,
		created_at INTEGER NOT NULL
	) STRICT;

	CREATE TABLE IF NOT EXISTS invitations (
		id INTEGER PRIMARY KEY,
		token_hash TEXT NOT NULL UNIQUE,
		expires_at INTEGER NOT NULL,
		used_at INTEGER,
		created_at INTEGER NOT NULL
	) STRICT;

	CREATE TABLE IF NOT EXISTS sessions (
		token_hash TEXT PRIMARY KEY,
		user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		expires_at INTEGER NOT NULL,
		created_at INTEGER NOT NULL
	) STRICT;

	CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
	CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);
`);

export default database;
