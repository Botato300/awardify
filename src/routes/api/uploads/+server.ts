import type { RequestHandler } from "./$types";
import { createVideoUpload, UploadError } from "../../../services/video-uploads.server";

export const POST: RequestHandler = async ({ locals, request }) => {
	const user = locals.user!;

	let input: unknown;
	try {
		input = await request.json();
	} catch {
		return Response.json({ message: "El cuerpo de la solicitud no es válido." }, { status: 400 });
	}

	if (typeof input !== "object" || input === null)
		return Response.json({ message: "El cuerpo de la solicitud no es válido." }, { status: 400 });

	const uploadInput = input as { nomineeId?: unknown; fileSize?: unknown };
	if (typeof uploadInput.nomineeId !== "string" || typeof uploadInput.fileSize !== "number")
		return Response.json({ message: "Faltan datos del video." }, { status: 400 });

	try {
		const upload = await createVideoUpload(user.id, uploadInput.nomineeId, uploadInput.fileSize);

		return Response.json(upload, { status: 201 });
	} catch (error) {
		if (error instanceof UploadError)
			return Response.json({ message: error.message }, { status: error.status });

		console.error("Video upload creation failed:", error);

		return Response.json({ message: "No se pudo iniciar la subida. Intenta de nuevo." }, { status: 500 });
	}
};
