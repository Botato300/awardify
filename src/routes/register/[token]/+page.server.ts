import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { createSession, registerWithInvitation } from "../../../services/auth.server";
import { setSessionCookie } from "../../../services/session-cookie.server";

export const load: PageServerLoad = ({ locals }) => {
	if (locals.user) redirect(303, "/");
};

export const actions: Actions = {
	default: async ({ params, request, cookies }) => {
		const data = await request.formData();
		const email = String(data.get("email") ?? "").trim().toLowerCase();
		const password = String(data.get("password") ?? "");

		if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) {
			return fail(400, { message: "Ingresa un email válido.", email });
		}

		if (password.length < 4 || password.length > 1024) {
			return fail(400, { message: "La contraseña debe tener entre 4 y 1024 caracteres.", email });
		}

		try {
			const user = await registerWithInvitation(params.token, email, password);
			if (!user) return fail(400, { message: "Este enlace venció o ya fue utilizado.", email });

			const token = createSession(user.id);
			setSessionCookie(cookies, token);
			redirect(303, "/");
		} catch (error) {
			if (error instanceof Error && error.message.includes("UNIQUE constraint failed: users.email")) {
				return fail(400, { message: "Ya existe una cuenta con ese email.", email });
			}
			throw error;
		}
	}
};
