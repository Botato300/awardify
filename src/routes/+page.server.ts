import { redirect } from "@sveltejs/kit";

import type { Actions, PageServerLoad } from "./$types";

import { deleteSession } from "../services/auth.server";
import { SESSION_COOKIE } from "../services/session-cookie.server";

export const load: PageServerLoad = ({ locals }) => {
	if (!locals.user)
		redirect(303, "/login");

	return { user: locals.user };
};

export const actions: Actions = {
	logout: ({ cookies, locals }) => {
		const token = cookies.get(SESSION_COOKIE);

		if (token)
			deleteSession(token);

		cookies.delete(SESSION_COOKIE, { path: "/" });
		locals.user = null;

		redirect(303, "/login");
	}
};
