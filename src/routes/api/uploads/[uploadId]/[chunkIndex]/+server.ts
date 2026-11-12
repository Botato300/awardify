import type { RequestHandler } from "./$types";
import { saveVideoUploadChunk, UploadError } from "../../../../../services/video-uploads.server";

export const PUT: RequestHandler = async ({ locals, params, request }) => {
	const user = locals.user!;

	if (!/^\d+$/.test(params.chunkIndex))
		return Response.json({ message: "El número de fragmento no es válido." }, { status: 400 });

	try {
		await saveVideoUploadChunk(
			user.id,
			params.uploadId,
			Number(params.chunkIndex),
			request.body,
			request.headers.get("content-length")
		);
		return new Response(null, { status: 204 });
	} catch (error) {
		if (error instanceof UploadError)
			return Response.json({ message: error.message }, { status: error.status });

		console.error("Video upload chunk failed:", error);
		return Response.json({ message: "No se pudo guardar este fragmento. Intenta de nuevo." }, { status: 500 });
	}
};
