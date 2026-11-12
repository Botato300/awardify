import { error, fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { findAward } from "../../../models/awards.server";
import { AwardError, createCategory, createNominee, removeCategory, removeNominee, renameNominee } from "../../../services/awards.server";

export const load: PageServerLoad = ({ locals, params }) => {
	const user = locals.user!;

	const award = findAward(user.id, params.awardId);
	if (!award)
		error(404, "No se encontró el award.");

	return { award };
};

export const actions: Actions = {
	createCategory: async ({ locals, params, request }) => {
		const user = locals.user!;

		const formData = await request.formData();
		const name = String(formData.get("name") ?? "");
		try {
			createCategory(user.id, params.awardId, name);
		} catch (error) {
			if (error instanceof AwardError)
				return fail(400, { message: error.message });

			console.error("Category creation failed:", error);
			return fail(500, { message: "No se pudo crear la categoría. Intenta de nuevo." });
		}
	},
	deleteCategory: async ({ locals, params, request }) => {
		const user = locals.user!;

		const formData = await request.formData();
		const categoryId = String(formData.get("categoryId") ?? "");
		if (!categoryId)
			return fail(400, { categoryDeleteMessage: "No se indicó qué categoría eliminar." });

		if (!await removeCategory(user.id, params.awardId, categoryId))
			return fail(404, { categoryDeleteMessage: "No se encontró la categoría o no tienes permiso para eliminarla." });

		return { categoryDeleted: true };
	},
	createNominee: async ({ locals, request }) => {
		const user = locals.user!;

		const formData = await request.formData();
		const categoryId = String(formData.get("categoryId") ?? "");
		const name = String(formData.get("name") ?? "");
		if (formData.get("videoSelected") !== "true")
			return fail(400, { message: "Selecciona un video para continuar." });

		try {
			const nominee = createNominee(user.id, categoryId, name);
			return { nominee };
		} catch (error) {
			if (error instanceof AwardError)
				return fail(400, { message: error.message });

			console.error("Nominee creation failed:", error);
			return fail(500, { message: "No se pudo crear el nominado. Intenta de nuevo." });
		}
	},
	editNominee: async ({ locals, params, request }) => {
		const user = locals.user!;

		const formData = await request.formData();
		const nomineeId = String(formData.get("nomineeId") ?? "");
		const name = String(formData.get("name") ?? "");
		if (!nomineeId)
			return fail(400, { nomineeEditMessage: "No se indicó qué nominado editar." });

		try {
			renameNominee(user.id, params.awardId, nomineeId, name);
			return { nominee: { id: nomineeId, name: name.trim() } };
		} catch (error) {
			if (error instanceof AwardError)
				return fail(400, { nomineeEditMessage: error.message });

			console.error("Nominee update failed:", error);
			return fail(500, { nomineeEditMessage: "No se pudo actualizar el nominado. Intenta de nuevo." });
		}
	},
	deleteNominee: async ({ locals, params, request }) => {
		const user = locals.user!;

		const formData = await request.formData();
		const nomineeId = String(formData.get("nomineeId") ?? "");
		if (!nomineeId)
			return fail(400, { message: "No se indicó qué nominado eliminar." });

		if (!await removeNominee(user.id, params.awardId, nomineeId))
			return fail(404, { message: "No se encontró el nominado o no tienes permiso para eliminarlo." });

		return { success: true };
	}
};
