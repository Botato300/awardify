import { fail, redirect } from "@sveltejs/kit";
import type { Actions } from "./$types";
import { createSession, registerWithInvitation } from "../../../services/auth.server";
import { setSessionCookie } from "../../../services/session-cookie.server";

function isUniqueConstraintError(error: unknown): boolean {
	return typeof error === "object" && error !== null && "code" in error && error.code === "SQLITE_CONSTRAINT_UNIQUE";
}

export const actions: Actions = {
	default: async ({ params, request, cookies }) => {
		const data = await request.formData();
		const email = String(data.get("email") ?? "").trim().toLowerCase();
		const password = String(data.get("password") ?? "");

		if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254)
			return fail(400, { message: "Ingresa un email válido.", email });

		if (password.length < 4 || password.length > 1024)
			return fail(400, { message: "La contraseña debe tener entre 4 y 1024 caracteres.", email });

		let user: Awaited<ReturnType<typeof registerWithInvitation>>;
		try {
			user = await registerWithInvitation(params.token, email, password);
		} catch (error) {
			if (isUniqueConstraintError(error))
				return fail(400, { message: "Ya existe una cuenta con ese email.", email });

			console.error("Account registration failed:", error);

			return fail(500, { message: "No se pudo crear la cuenta. Intenta de nuevo.", email });
		}

		if (!user)
			return fail(400, { message: "Este enlace venció o ya fue utilizado.", email });

		const token = createSession(user.id);
		setSessionCookie(cookies, token);
		redirect(303, "/");
	}
};
