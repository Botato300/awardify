import type { RequestHandler } from "./$types";
import { cancelVideoUpload, UploadError } from "../../../../services/video-uploads.server";

export const DELETE: RequestHandler = async ({ locals, params }) => {
	const user = locals.user!;

	try {
		await cancelVideoUpload(user.id, params.uploadId);

		return new Response(null, { status: 204 });
	} catch (error) {
		if (error instanceof UploadError)
			return Response.json({ message: error.message }, { status: error.status });

		console.error("Video upload cleanup failed:", error);

		return Response.json({ message: "No se pudo limpiar la subida. Intenta de nuevo." }, { status: 500 });
	}
};
