import { fail, redirect } from "@sveltejs/kit";

import type { Actions, PageServerLoad } from "./$types";

import { AwardError, createAward, getAwards, removeAward } from "../services/awards.server";
import { deleteSession } from "../services/auth.server";
import { SESSION_COOKIE } from "../services/session-cookie.server";

export const load: PageServerLoad = ({ locals }) => {
	const user = locals.user!;

	return {
		user,
		awards: getAwards(user.id)
	};
};

export const actions: Actions = {
	createAward: async ({ request, locals }) => {
		const user = locals.user!;

		const formData = await request.formData();
		const name = String(formData.get("name") ?? "");
		let awardId: string;
		try {
			awardId = createAward(user.id, name);
		} catch (error) {
			if (error instanceof AwardError)
				return fail(400, { message: error.message, name });

			console.error("Award creation failed:", error);
			return fail(500, { message: "No se pudo crear el award. Intenta de nuevo.", name });
		}

		redirect(303, `/awards/${awardId}`);
	},
	deleteAward: async ({ request, locals }) => {
		const user = locals.user!;

		const formData = await request.formData();
		const awardId = String(formData.get("awardId") ?? "");
		if (!awardId)
			return fail(400, { deleteMessage: "No se indicó qué award eliminar." });

		if (!await removeAward(user.id, awardId))
			return fail(404, { deleteMessage: "No se encontró el award o no tienes permiso para eliminarlo." });

		return { deleteSuccess: true };
	},
	logout: ({ cookies, locals }) => {
		const token = cookies.get(SESSION_COOKIE);

		if (token)
			deleteSession(token);

		cookies.delete(SESSION_COOKIE, { path: "/" });
		locals.user = null;

		redirect(303, "/login");
	}
};
