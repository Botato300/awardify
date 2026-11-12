import { randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, open, readdir, rename, rm, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileTypeFromFile } from "file-type";
import type { Video } from "../models/award";
import { MAX_VIDEO_SIZE } from "./video-upload-limits";
import {
	completeVideoUploadChunk,
	deleteExpiredVideoUpload,
	deleteVideoUpload,
	findExpiredVideoUploads,
	findVideoUpload,
	insertVideoUpload,
	listVideoUploadChunks,
	removeVideoUploadChunk,
	reserveVideoUploadChunk,
	saveUploadedVideo
} from "../models/uploads.server";

export const VIDEO_CHUNK_SIZE = 8 * 1024 * 1024;
export const VIDEO_UPLOAD_TTL = 6 * 60 * 60 * 1000;

const uploadsDirectory = resolve(process.cwd(), "data", "uploads");
const stagingDirectory = join(uploadsDirectory, ".staging");
const videosDirectory = join(uploadsDirectory, "videos");

export class UploadError extends Error {
	constructor(message: string, public status: number) {
		super(message);
	}
}

function stagingPath(uploadId: string): string {
	return join(stagingDirectory, uploadId);
}

function partialVideoPath(uploadId: string): string {
	return join(stagingPath(uploadId), "video.partial");
}

function expectedChunkSize(uploadSize: number, chunkCount: number, chunkIndex: number): number {
	if (chunkIndex < chunkCount - 1)
		return VIDEO_CHUNK_SIZE;

	return uploadSize - VIDEO_CHUNK_SIZE * (chunkCount - 1);
}

export async function createVideoUpload(
	userId: number,
	nomineeId: string,
	fileSize: number
): Promise<{ id: string; chunkSize: number; chunkCount: number }> {
	if (!Number.isSafeInteger(fileSize) || fileSize < 1)
		throw new UploadError("El archivo está vacío o tiene un tamaño inválido.", 400);

	if (fileSize > MAX_VIDEO_SIZE)
		throw new UploadError("El tamaño máximo permitido por video es 300 MB.", 413);

	const id = randomUUID();
	const chunkCount = Math.ceil(fileSize / VIDEO_CHUNK_SIZE);
	const now = Date.now();
	const directory = stagingPath(id);
	await mkdir(directory, { recursive: true });

	try {
		const partialFile = await open(partialVideoPath(id), "wx");
		await partialFile.close();

		const inserted = insertVideoUpload(id, userId, nomineeId, fileSize, chunkCount, now);
		if (!inserted)
			throw new UploadError("No se encontró el nominado o no tienes permiso para modificarlo.", 404);
	} catch (error) {
		await rm(directory, { recursive: true, force: true });
		throw error;
	}

	return { id, chunkSize: VIDEO_CHUNK_SIZE, chunkCount };
}

export async function saveVideoUploadChunk(
	userId: number,
	uploadId: string,
	chunkIndex: number,
	body: ReadableStream<Uint8Array> | null,
	contentLength: string | null
): Promise<void> {
	const upload = findVideoUpload(userId, uploadId);
	if (!upload)
		throw new UploadError("No se encontró la carga.", 404);

	const now = Date.now();
	if (upload.updated_at <= now - VIDEO_UPLOAD_TTL)
		throw new UploadError("La carga venció. Inicia una nueva.", 410);

	if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= upload.chunk_count)
		throw new UploadError("El número de fragmento no es válido.", 400);

	const expectedSize = expectedChunkSize(upload.expected_size, upload.chunk_count, chunkIndex);
	if (contentLength !== null && Number(contentLength) !== expectedSize)
		throw new UploadError("El tamaño del fragmento no coincide con lo esperado.", 400);

	const reserved = reserveVideoUploadChunk(userId, uploadId, chunkIndex, now, now - VIDEO_UPLOAD_TTL);
	if (!reserved)
		throw new UploadError("Este fragmento ya se está cargando o ya fue recibido.", 409);

	if (!body) {
		removeVideoUploadChunk(uploadId, chunkIndex);
		throw new UploadError("El fragmento no contiene datos.", 400);
	}

	const directory = stagingPath(uploadId);
	const temporaryPath = join(directory, `${chunkIndex}.${randomUUID()}.part`);
	let receivedBytes = 0;

	const sizeLimit = new Transform({
		transform(chunk: Buffer, _encoding, callback) {
			receivedBytes += chunk.length;
			if (receivedBytes > expectedSize) {
				callback(new UploadError("El fragmento supera el tamaño esperado.", 413));
				return;
			}

			callback(null, chunk);
		}
	});

	try {
		await pipeline(Readable.from(body as AsyncIterable<Uint8Array>), sizeLimit, createWriteStream(temporaryPath, { flags: "wx" }));
		if (receivedBytes !== expectedSize)
			throw new UploadError("El fragmento llegó incompleto.", 400);

		const partialFile = await open(partialVideoPath(uploadId), "r+");
		try {
			let position = chunkIndex * VIDEO_CHUNK_SIZE;
			for await (const chunk of createReadStream(temporaryPath)) {
				let chunkOffset = 0;
				while (chunkOffset < chunk.length) {
					const result = await partialFile.write(chunk, chunkOffset, chunk.length - chunkOffset, position);
					if (result.bytesWritten === 0)
						throw new Error("Could not write the uploaded chunk");

					chunkOffset += result.bytesWritten;
					position += result.bytesWritten;
				}
			}
		} finally {
			await partialFile.close();
		}

		if (!completeVideoUploadChunk(uploadId, chunkIndex, receivedBytes))
			throw new UploadError("La sesión de carga dejó de estar disponible.", 410);
	} catch (error) {
		await rm(temporaryPath, { force: true });
		removeVideoUploadChunk(uploadId, chunkIndex);
		throw error;
	}
}

export async function finishVideoUpload(userId: number, uploadId: string): Promise<Video> {
	const upload = findVideoUpload(userId, uploadId);
	if (!upload)
		throw new UploadError("No se encontró la carga.", 404);

	if (upload.updated_at <= Date.now() - VIDEO_UPLOAD_TTL)
		throw new UploadError("La carga venció. Inicia una nueva.", 410);

	const chunks = listVideoUploadChunks(uploadId);
	if (chunks.length !== upload.chunk_count || chunks.some((chunk, index) =>
		chunk.chunk_index !== index || chunk.size_bytes !== expectedChunkSize(upload.expected_size, upload.chunk_count, index)
	))
		throw new UploadError("Faltan fragmentos o alguno está incompleto.", 400);

	const staging = stagingPath(uploadId);
	let finalPath: string | undefined;
	let saved = false;

	try {
		const partialFile = partialVideoPath(uploadId);
		const fileInfo = await stat(partialFile);
		if (fileInfo.size !== upload.expected_size)
			throw new UploadError("El tamaño final no coincide con el archivo original.", 400);

		const fileType = await fileTypeFromFile(partialFile);
		if (fileType?.mime !== "video/mp4" && fileType?.mime !== "video/webm")
			throw new UploadError("Solo se permiten videos MP4 y WebM.", 415);

		const video: Video & { nominee_id: string } = {
			id: randomUUID(),
			nominee_id: upload.nominee_id,
			mime_type: fileType.mime,
			size_bytes: fileInfo.size,
			created_at: Date.now()
		};
		const extension = fileType.mime === "video/mp4" ? ".mp4" : ".webm";

		await mkdir(videosDirectory, { recursive: true });
		finalPath = join(videosDirectory, `${video.id}${extension}`);
		await rename(partialFile, finalPath);
		const previousVideos = saveUploadedVideo(userId, uploadId, video);
		saved = true;
		await removeVideoFiles(previousVideos, []);
		await rm(staging, { recursive: true, force: true }).catch((error) => {
			console.error("Could not remove completed upload chunks:", error);
		});

		return video;
	} catch (error) {
		if (finalPath && !saved) {
			await rename(finalPath, partialVideoPath(uploadId)).catch((restoreError) => {
				console.error("Could not restore uploaded video after a failed save:", restoreError);
			});
		}

		if (error instanceof UploadError && error.status === 415) {
			deleteVideoUpload(userId, uploadId);
			await rm(staging, { recursive: true, force: true });
		}

		throw error;
	}
}

export async function cancelVideoUpload(userId: number, uploadId: string): Promise<void> {
	if (!deleteVideoUpload(userId, uploadId))
		throw new UploadError("No se encontró la carga.", 404);

	await rm(stagingPath(uploadId), { recursive: true, force: true });
}

export function getVideoFilePath(video: Pick<Video, "id" | "mime_type">): string {
	const extension = video.mime_type === "video/mp4" ? ".mp4" : ".webm";
	return join(videosDirectory, `${video.id}${extension}`);
}

export async function removeVideoFiles(
	videos: Pick<Video, "id" | "mime_type">[],
	uploadIds: string[]
): Promise<void> {
	const results = await Promise.allSettled([
		...videos.map((video) => rm(getVideoFilePath(video), { force: true })),
		...uploadIds.map((uploadId) => rm(stagingPath(uploadId), { recursive: true, force: true }))
	]);

	for (const result of results) {
		if (result.status === "rejected")
			console.error("Could not remove video files:", result.reason);
	}
}

let cleanupInProgress = false;

export async function cleanupExpiredVideoUploads(): Promise<void> {
	if (cleanupInProgress)
		return;

	cleanupInProgress = true;
	try {
		const expiresAfter = Date.now() - VIDEO_UPLOAD_TTL;
		for (const upload of findExpiredVideoUploads(expiresAfter)) {
			if (deleteExpiredVideoUpload(upload.id, expiresAfter))
				await rm(stagingPath(upload.id), { recursive: true, force: true });
		}

		for (const entry of await readdir(stagingDirectory, { withFileTypes: true }).catch(() => [])) {
			if (!entry.isDirectory())
				continue;

			const directory = join(stagingDirectory, entry.name);
			const details = await stat(directory).catch(() => null);
			if (details && details.mtimeMs <= expiresAfter)
				await rm(directory, { recursive: true, force: true });
		}
	} finally {
		cleanupInProgress = false;
	}
}

type CleanupGlobal = typeof globalThis & {
	awardifyVideoUploadCleanup?: ReturnType<typeof setInterval>;
};

export function startVideoUploadCleanup(): void {
	const cleanupGlobal = globalThis as CleanupGlobal;
	if (cleanupGlobal.awardifyVideoUploadCleanup)
		return;

	void cleanupExpiredVideoUploads().catch((error) => console.error("Upload cleanup failed:", error));
	cleanupGlobal.awardifyVideoUploadCleanup = setInterval(() => {
		void cleanupExpiredVideoUploads().catch((error) => console.error("Upload cleanup failed:", error));
	}, 10 * 60 * 1000);
	cleanupGlobal.awardifyVideoUploadCleanup.unref();
}
