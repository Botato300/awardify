import { redirect } from "@sveltejs/kit";
import type { Handle, HandleServerError } from "@sveltejs/kit/hooks";
import { getUserForSession } from "./services/auth.server";
import { SESSION_COOKIE } from "./services/session-cookie.server";
import { startVideoUploadCleanup } from "./services/video-uploads.server";

startVideoUploadCleanup();

export const handle: Handle = async ({ event, resolve }) => {
	const sessionToken = event.cookies.get(SESSION_COOKIE);
	event.locals.user = sessionToken ? getUserForSession(sessionToken) : null;
	const pathname = event.url.pathname;
	const isAwardManagementRequest = pathname.startsWith("/awards/");
	const isUploadApiRequest = pathname === "/api/uploads" || pathname.startsWith("/api/uploads/");
	const isVideoRequest = pathname.startsWith("/media/");

	if (!event.locals.user) {
		if (isUploadApiRequest)
			return Response.json({ message: "Inicia sesión para continuar." }, { status: 401 });

		if (isVideoRequest)
			return new Response("Not found", { status: 404 });

		if (pathname === "/" || isAwardManagementRequest)
			redirect(303, "/login");
	}

	if ((pathname === "/login" || pathname.startsWith("/register/")) && event.locals.user)
		redirect(303, "/");

	return resolve(event);
};

export const handleError: HandleServerError = ({ kind, error }) => {
	if (kind === "app" || kind === "framework")
		return error;

	console.error("Unhandled server error:", error);
	return { message: "Ocurrió un error inesperado. Intenta de nuevo." };
};
