import { randomBytes, createHash } from "node:crypto";
import database from "../src/db/database.server.ts";

function getOption(name: string): string | undefined {
	const index = process.argv.indexOf(name);

	return index === -1 ? undefined : process.argv[index + 1];
}

function parseDuration(value: string | undefined): number {
	const match = /^(\d+)(h|d)$/.exec(value ?? "7d");
	if (!match)
		throw new Error("La expiración debe tener formato, por ejemplo: 12h o 7d.");

	const amount = Number(match[1]);
	const milliseconds = amount * (match[2] === "h" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000);

	if (amount < 1 || milliseconds > 90 * 24 * 60 * 60 * 1000)
		throw new Error("La expiración debe ser mayor que cero y no superar 90 días.");

	return milliseconds;
}

try {
	const baseUrl = getOption("--base-url");

	if (!baseUrl)
		throw new Error("Indica la URL pública con --base-url https://awardify.example.com");

	const url = new URL(baseUrl);
	if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1")
		throw new Error("La URL debe usar HTTPS (excepto en localhost).");

	const token = randomBytes(32).toString("base64url");
	const tokenHash = createHash("sha256").update(token).digest("hex");
	const expiresAt = Date.now() + parseDuration(getOption("--expires-in"));

	database.prepare(`
		INSERT INTO invitations (token_hash, expires_at, created_at) VALUES (?, ?, ?)
	`).run(tokenHash, expiresAt, Date.now());

	url.pathname = `${url.pathname.replace(/\/$/, "")}/register/${token}`;
	url.search = "";
	url.hash = "";
	console.log(`Invitación válida hasta ${new Date(expiresAt).toISOString()}:\n${url.toString()}`);
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
}
