import { argon2 as argon2Callback, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { User } from "../models/user";
import {
	createSession as saveSession,
	deleteSession as removeSession,
	findUserByEmail,
	findSessionUser,
	registerUserWithInvitation
} from "../models/auth.server";

const argon2 = promisify(argon2Callback);
export const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30;
const PASSWORD_HASH_PARAMETERS = {
	parallelism: 1,
	tagLength: 32,
	memory: 19 * 1024,
	passes: 2
};
const PASSWORD_HASH_PATTERN = /^\$argon2id\$v=19\$m=19456,t=2,p=1\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/;

function hashToken(token: string): string {
	return createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(16);
	const derivedKey = await argon2("argon2id", {
		message: password,
		nonce: salt,
		...PASSWORD_HASH_PARAMETERS
	});

	const encodedSalt = salt.toString("base64").replace(/=+$/, "");
	const encodedKey = derivedKey.toString("base64").replace(/=+$/, "");

	return `$argon2id$v=19$m=19456,t=2,p=1$${encodedSalt}$${encodedKey}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
	const match = PASSWORD_HASH_PATTERN.exec(storedHash);

	if (!match)
		return false;

	const salt = Buffer.from(match[1], "base64");
	const expected = Buffer.from(match[2], "base64");
	if (salt.length !== 16 || expected.length !== PASSWORD_HASH_PARAMETERS.tagLength)
		return false;

	const actual = await argon2("argon2id", {
		message: password,
		nonce: salt,
		...PASSWORD_HASH_PARAMETERS
	});

	return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function registerWithInvitation(token: string, email: string, password: string): Promise<User | null> {
	const tokenHash = hashToken(token);
	const passwordHash = await hashPassword(password);

	return registerUserWithInvitation(tokenHash, email, passwordHash, Date.now());
}

export function findUser(email: string) {
	return findUserByEmail(email);
}

export function createSession(userId: number): string {
	const token = randomBytes(32).toString("base64url");
	const now = Date.now();
	saveSession(hashToken(token), userId, now + SESSION_DURATION_SECONDS * 1000, now);

	return token;
}

export function getUserForSession(token: string): User | null {
	const now = Date.now();
	const session = findSessionUser(hashToken(token));

	if (!session)
		return null;

	if (session.expires_at <= now) {
		deleteSession(token);
		return null;
	}

	return { id: session.id, email: session.email };
}

export function deleteSession(token: string): void {
	removeSession(hashToken(token));
}
