import type { RequestHandler } from "./$types";
import { finishVideoUpload, UploadError } from "../../../../../services/video-uploads.server";

export const POST: RequestHandler = async ({ locals, params }) => {
	const user = locals.user!;

	try {
		const video = await finishVideoUpload(user.id, params.uploadId);
		return Response.json({ id: video.id }, { status: 201 });
	} catch (error) {
		if (error instanceof UploadError)
			return Response.json({ message: error.message }, { status: error.status });

		console.error("Video processing failed:", error);
		return Response.json({ message: "No se pudo procesar el video. Intenta de nuevo." }, { status: 500 });
	}
};
