import type { Cookies } from "@sveltejs/kit";
import { SESSION_DURATION_SECONDS } from "./auth.server";

export const SESSION_COOKIE = "awardify_session";

export function setSessionCookie(cookies: Cookies, token: string): void {
	cookies.set(SESSION_COOKIE, token, {
		path: "/",
		httpOnly: true,
		secure: process.env.NODE_ENV !== "development",
		sameSite: "lax",
		maxAge: SESSION_DURATION_SECONDS
	});
}
