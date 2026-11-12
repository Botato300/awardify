import type { User } from "./user";
import type { Video } from "./award";
import database from "../db/database.server.ts";

export type VideoUpload = {
	id: string;
	user_id: number;
	nominee_id: string;
	expected_size: number;
	chunk_count: number;
	created_at: number;
	updated_at: number;
};

export type VideoUploadChunk = {
	chunk_index: number;
	size_bytes: number;
};

export function insertVideoUpload(
	id: string,
	userId: number,
	nomineeId: string,
	expectedSize: number,
	chunkCount: number,
	now: number
): boolean {
	const result = database.prepare(`
		INSERT INTO video_uploads (id, user_id, nominee_id, expected_size, chunk_count, created_at, updated_at)
		SELECT ?, ?, nominees.id, ?, ?, ?, ?
		FROM nominees
		JOIN categories ON categories.id = nominees.category_id
		JOIN awards ON awards.id = categories.award_id
		WHERE nominees.id = ? AND awards.owner_user_id = ?
	`).run(id, userId, expectedSize, chunkCount, now, now, nomineeId, userId);

	return result.changes === 1;
}

export function findVideoUpload(userId: number, uploadId: string): VideoUpload | undefined {
	return database.prepare(`
		SELECT id, user_id, nominee_id, expected_size, chunk_count, created_at, updated_at
		FROM video_uploads
		WHERE id = ? AND user_id = ?
	`).get(uploadId, userId) as VideoUpload | undefined;
}

export function reserveVideoUploadChunk(
	userId: number,
	uploadId: string,
	chunkIndex: number,
	updatedAt: number,
	expiresAfter: number
): boolean {
	const reserve = database.transaction(() => {
		const upload = database.prepare(`
			UPDATE video_uploads SET updated_at = ?
			WHERE id = ? AND user_id = ? AND updated_at > ?
		`).run(updatedAt, uploadId, userId, expiresAfter);

		if (upload.changes !== 1)
			return false;

		database.prepare(`
			INSERT INTO video_upload_chunks (upload_id, chunk_index, size_bytes) VALUES (?, ?, -1)
		`).run(uploadId, chunkIndex);

		return true;
	});

	try {
		return reserve.immediate();
	} catch (error) {
		if (error instanceof Error && error.message.includes("UNIQUE constraint failed: video_upload_chunks.upload_id"))
			return false;

		throw error;
	}
}

export function completeVideoUploadChunk(uploadId: string, chunkIndex: number, sizeBytes: number): boolean {
	const result = database.prepare(`
		UPDATE video_upload_chunks SET size_bytes = ?
		WHERE upload_id = ? AND chunk_index = ? AND size_bytes = -1
	`).run(sizeBytes, uploadId, chunkIndex);

	return result.changes === 1;
}

export function removeVideoUploadChunk(uploadId: string, chunkIndex: number): void {
	database.prepare(`
		DELETE FROM video_upload_chunks WHERE upload_id = ? AND chunk_index = ?
	`).run(uploadId, chunkIndex);
}

export function listVideoUploadChunks(uploadId: string): VideoUploadChunk[] {
	return database.prepare(`
		SELECT chunk_index, size_bytes
		FROM video_upload_chunks
		WHERE upload_id = ?
		ORDER BY chunk_index
	`).all(uploadId) as VideoUploadChunk[];
}

export function saveUploadedVideo(
	userId: number,
	uploadId: string,
	video: Video & { nominee_id: string }
): Pick<Video, "id" | "mime_type">[] {
	const save = database.transaction(() => {
		const previousVideos = database.prepare(`
			SELECT id, mime_type
			FROM videos
			WHERE nominee_id = ?
		`).all(video.nominee_id) as Pick<Video, "id" | "mime_type">[];

		database.prepare("DELETE FROM videos WHERE nominee_id = ?").run(video.nominee_id);
		database.prepare(`
			INSERT INTO videos (id, nominee_id, mime_type, size_bytes, created_at)
			VALUES (?, ?, ?, ?, ?)
		`).run(video.id, video.nominee_id, video.mime_type, video.size_bytes, video.created_at);

		const result = database.prepare(`
			DELETE FROM video_uploads WHERE id = ? AND user_id = ?
		`).run(uploadId, userId);

		if (result.changes !== 1)
			throw new Error("Upload session no longer exists");

		return previousVideos;
	});

	return save.immediate();
}

export function deleteVideoUpload(userId: number, uploadId: string): boolean {
	const result = database.prepare(`
		DELETE FROM video_uploads WHERE id = ? AND user_id = ?
	`).run(uploadId, userId);

	return result.changes === 1;
}

export function findExpiredVideoUploads(expiresAfter: number): VideoUpload[] {
	return database.prepare(`
		SELECT id, user_id, nominee_id, expected_size, chunk_count, created_at, updated_at
		FROM video_uploads
		WHERE updated_at <= ?
	`).all(expiresAfter) as VideoUpload[];
}

export function deleteExpiredVideoUpload(uploadId: string, expiresAfter: number): boolean {
	const result = database.prepare(`
		DELETE FROM video_uploads WHERE id = ? AND updated_at <= ?
	`).run(uploadId, expiresAfter);

	return result.changes === 1;
}

export function findVideoForOwner(user: User, videoId: string): (Video & { nominee_id: string }) | undefined {
	return database.prepare(`
		SELECT videos.id, videos.nominee_id, videos.mime_type, videos.size_bytes, videos.created_at
		FROM videos
		JOIN nominees ON nominees.id = videos.nominee_id
		JOIN categories ON categories.id = nominees.category_id
		JOIN awards ON awards.id = categories.award_id
		WHERE videos.id = ? AND awards.owner_user_id = ?
	`).get(videoId, user.id) as (Video & { nominee_id: string }) | undefined;
}
