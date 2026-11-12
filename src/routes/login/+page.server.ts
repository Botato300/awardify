import { fail, redirect } from "@sveltejs/kit";
import type { Actions } from "./$types";
import { createSession, findUser, verifyPassword } from "../../services/auth.server";
import { setSessionCookie } from "../../services/session-cookie.server";

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const data = await request.formData();
		const email = String(data.get("email") ?? "").trim().toLowerCase();
		const password = String(data.get("password") ?? "");

		if (!email || !password || email.length > 254 || password.length > 1024)
			return fail(400, { message: "Email o contraseña incorrectos.", email });

		const user = findUser(email);

		if (!user || !(await verifyPassword(password, user.password_hash)))
			return fail(400, { message: "Email o contraseña incorrectos.", email });

		const token = createSession(user.id);
		setSessionCookie(cookies, token);
		redirect(303, "/");
	}
};
