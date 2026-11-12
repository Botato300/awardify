import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import type { RequestHandler } from "./$types";
import { findVideoForOwner } from "../../../models/uploads.server";
import { getVideoFilePath } from "../../../services/video-uploads.server";

type ByteRange = { start: number; end: number };

function parseByteRange(value: string, size: number): ByteRange | null {
	const match = /^bytes=(\d*)-(\d*)$/.exec(value);
	if (!match || (!match[1] && !match[2]))
		return null;

	if (!match[1]) {
		const suffixLength = Number(match[2]);
		if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0)
			return null;

		return { start: Math.max(0, size - suffixLength), end: size - 1 };
	}

	const start = Number(match[1]);
	const end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
	if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= size)
		return null;

	return { start, end };
}

async function serveVideo(event: Parameters<RequestHandler>[0]): Promise<Response> {
	const user = event.locals.user!;

	const video = findVideoForOwner(user, event.params.videoId);
	if (!video)
		return new Response("Not found", { status: 404 });

	const filePath = getVideoFilePath(video);
	const fileInfo = await stat(filePath).catch(() => null);
	if (!fileInfo?.isFile())
		return new Response("Not found", { status: 404 });

	const headers = new Headers({
		"Accept-Ranges": "bytes",
		"Cache-Control": "private, max-age=60",
		"Content-Type": video.mime_type,
		"Content-Length": String(fileInfo.size),
		"X-Content-Type-Options": "nosniff"
	});
	const rangeHeader = event.request.headers.get("range");

	if (!rangeHeader) {
		if (event.request.method === "HEAD")
			return new Response(null, { headers });

		const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream<Uint8Array>;
		return new Response(stream, { headers });
	}

	const range = parseByteRange(rangeHeader, fileInfo.size);
	if (!range) {
		return new Response(null, {
			status: 416,
			headers: { "Content-Range": `bytes */${fileInfo.size}`, "Accept-Ranges": "bytes" }
		});
	}

	const rangeLength = range.end - range.start + 1;
	headers.set("Content-Length", String(rangeLength));
	headers.set("Content-Range", `bytes ${range.start}-${range.end}/${fileInfo.size}`);
	if (event.request.method === "HEAD")
		return new Response(null, { status: 206, headers });

	const stream = Readable.toWeb(createReadStream(filePath, { start: range.start, end: range.end })) as ReadableStream<Uint8Array>;
	return new Response(stream, { status: 206, headers });
}

export const GET: RequestHandler = serveVideo;
export const HEAD: RequestHandler = serveVideo;
