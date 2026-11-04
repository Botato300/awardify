import type { User, UserWithPassword } from "./user";
import database from "../db/database.server.ts";

export function findUserByEmail(email: string): UserWithPassword | undefined {
	return database.prepare(`
		SELECT id, email, password_hash FROM users WHERE email = ?
	`).get(email) as UserWithPassword | undefined;
}

export function registerUserWithInvitation(
	tokenHash: string,
	email: string,
	passwordHash: string,
	now: number
): User | null {
	const register = database.transaction(() => {
		const invitation = database.prepare(`
			SELECT id FROM invitations
			WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?
		`).get(tokenHash, now) as { id: number } | undefined;

		if (!invitation)
			return null;

		const result = database.prepare(`
			INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)
		`).run(email, passwordHash, now);

		const consumed = database.prepare(`
			UPDATE invitations SET used_at = ? WHERE id = ? AND used_at IS NULL AND expires_at > ?
		`).run(now, invitation.id, now);

		if (consumed.changes !== 1)
			throw new Error("Invitation could not be consumed");

		return { id: Number(result.lastInsertRowid), email };
	});

	return register.immediate();
}

export function createSession(tokenHash: string, userId: number, expiresAt: number, createdAt: number): void {
	database.prepare(`
		INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)
	`).run(tokenHash, userId, expiresAt, createdAt);
	database.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(createdAt);
}

export function findSessionUser(tokenHash: string): (User & { expires_at: number }) | undefined {
	return database.prepare(`
		SELECT users.id, users.email, sessions.expires_at
		FROM sessions JOIN users ON users.id = sessions.user_id
		WHERE sessions.token_hash = ?
	`).get(tokenHash) as (User & { expires_at: number }) | undefined;
}

export function deleteSession(tokenHash: string): void {
	database.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
}
