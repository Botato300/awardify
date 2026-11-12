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

	CREATE TABLE IF NOT EXISTS awards (
		id TEXT PRIMARY KEY,
		owner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		name TEXT NOT NULL,
		created_at INTEGER NOT NULL
	) STRICT;

	CREATE INDEX IF NOT EXISTS awards_owner_user_id_idx ON awards(owner_user_id);

	CREATE TABLE IF NOT EXISTS categories (
		id TEXT PRIMARY KEY,
		award_id TEXT NOT NULL REFERENCES awards(id) ON DELETE CASCADE,
		name TEXT NOT NULL,
		created_at INTEGER NOT NULL,
		UNIQUE (award_id, name)
	) STRICT;

	CREATE TABLE IF NOT EXISTS nominees (
		id TEXT PRIMARY KEY,
		category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
		name TEXT NOT NULL,
		created_at INTEGER NOT NULL,
		UNIQUE (category_id, name)
	) STRICT;

	CREATE TABLE IF NOT EXISTS videos (
		id TEXT PRIMARY KEY,
		nominee_id TEXT NOT NULL REFERENCES nominees(id) ON DELETE CASCADE,
		mime_type TEXT NOT NULL CHECK (mime_type IN ('video/mp4', 'video/webm')),
		size_bytes INTEGER NOT NULL,
		created_at INTEGER NOT NULL
	) STRICT;

	CREATE INDEX IF NOT EXISTS videos_nominee_id_idx ON videos(nominee_id);

	CREATE TABLE IF NOT EXISTS video_uploads (
		id TEXT PRIMARY KEY,
		user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		nominee_id TEXT NOT NULL REFERENCES nominees(id) ON DELETE CASCADE,
		expected_size INTEGER NOT NULL,
		chunk_count INTEGER NOT NULL,
		created_at INTEGER NOT NULL,
		updated_at INTEGER NOT NULL
	) STRICT;

	CREATE INDEX IF NOT EXISTS video_uploads_updated_at_idx ON video_uploads(updated_at);

	CREATE TABLE IF NOT EXISTS video_upload_chunks (
		upload_id TEXT NOT NULL REFERENCES video_uploads(id) ON DELETE CASCADE,
		chunk_index INTEGER NOT NULL,
		size_bytes INTEGER NOT NULL,
		PRIMARY KEY (upload_id, chunk_index)
	) STRICT;
`);

const removeOriginalNameColumns = database.transaction(() => {
	for (const table of ["videos", "video_uploads"]) {
		const columns = database.pragma(`table_info(${table})`) as { name: string }[];
		if (columns.some((column) => column.name === "original_name"))
			database.exec(`ALTER TABLE ${table} DROP COLUMN original_name`);
	}
});

removeOriginalNameColumns.immediate();

export default database;
