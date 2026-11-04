import { redirect } from "@sveltejs/kit";
import type { Handle } from "@sveltejs/kit/hooks";
import { getUserForSession } from "./services/auth.server";
import { SESSION_COOKIE } from "./services/session-cookie.server";

export const handle: Handle = async ({ event, resolve }) => {
	const sessionToken = event.cookies.get(SESSION_COOKIE);
	event.locals.user = sessionToken ? getUserForSession(sessionToken) : null;

	if (event.url.pathname === "/" && !event.locals.user)
		redirect(303, "/login");

	if ((event.url.pathname === "/login" || event.url.pathname.startsWith("/register/")) && event.locals.user)
		redirect(303, "/");

	return resolve(event);
};
