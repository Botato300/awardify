import type { Award, AwardManagement, Category, Nominee, Video } from "./award";
import database from "../db/database.server.ts";

export function listAwards(userId: number): Award[] {
	return database.prepare(`
		SELECT id, name, created_at
		FROM awards
		WHERE owner_user_id = ?
		ORDER BY created_at DESC
	`).all(userId) as Award[];
}

export function insertAward(id: string, userId: number, name: string, createdAt: number): void {
	database.prepare(`
		INSERT INTO awards (id, owner_user_id, name, created_at)
		VALUES (?, ?, ?, ?)
	`).run(id, userId, name, createdAt);
}

export function deleteAward(
	userId: number,
	awardId: string
): { videos: Pick<Video, "id" | "mime_type">[]; uploadIds: string[] } | null {
	const remove = database.transaction(() => {
		const award = database.prepare(`
			SELECT id
			FROM awards
			WHERE id = ? AND owner_user_id = ?
		`).get(awardId, userId);

		if (!award)
			return null;

		const videos = database.prepare(`
			SELECT videos.id, videos.mime_type
			FROM videos
			JOIN nominees ON nominees.id = videos.nominee_id
			JOIN categories ON categories.id = nominees.category_id
			WHERE categories.award_id = ?
		`).all(awardId) as Pick<Video, "id" | "mime_type">[];

		const uploads = database.prepare(`
			SELECT video_uploads.id
			FROM video_uploads
			JOIN nominees ON nominees.id = video_uploads.nominee_id
			JOIN categories ON categories.id = nominees.category_id
			WHERE categories.award_id = ?
		`).all(awardId) as { id: string }[];

		const result = database.prepare(`
			DELETE FROM awards
			WHERE id = ? AND owner_user_id = ?
		`).run(awardId, userId);

		if (result.changes !== 1)
			return null;

		return { videos, uploadIds: uploads.map((upload) => upload.id) };
	});

	return remove.immediate();
}

export function findAward(userId: number, awardId: string): AwardManagement | null {
	const award = database.prepare(`
		SELECT id, name, created_at
		FROM awards
		WHERE id = ? AND owner_user_id = ?
	`).get(awardId, userId) as Award | undefined;

	if (!award)
		return null;

	const categories = database.prepare(`
		SELECT id, name, created_at
		FROM categories
		WHERE award_id = ?
		ORDER BY created_at DESC
	`).all(awardId) as Category[];

	return {
		...award,
		categories: categories.map((category) => {
			const nominees = database.prepare(`
				SELECT id, name, created_at
				FROM nominees
				WHERE category_id = ?
				ORDER BY created_at
			`).all(category.id) as Nominee[];

			return {
				...category,
				nominees: nominees.map((nominee) => {
					const videos = database.prepare(`
						SELECT id, mime_type, size_bytes, created_at
						FROM videos
						WHERE nominee_id = ?
						ORDER BY created_at
					`).all(nominee.id) as Video[];

					return { ...nominee, videos };
				})
			};
		})
	};
}

export function insertCategory(id: string, userId: number, awardId: string, name: string, createdAt: number): boolean {
	const result = database.prepare(`
		INSERT INTO categories (id, award_id, name, created_at)
		SELECT ?, awards.id, ?, ?
		FROM awards
		WHERE awards.id = ? AND awards.owner_user_id = ?
	`).run(id, name, createdAt, awardId, userId);
	return result.changes === 1;
}

export function insertNominee(
	id: string,
	userId: number,
	categoryId: string,
	name: string,
	createdAt: number
): boolean {
	const result = database.prepare(`
		INSERT INTO nominees (id, category_id, name, created_at)
		SELECT ?, categories.id, ?, ?
		FROM categories
		JOIN awards ON awards.id = categories.award_id
		WHERE categories.id = ? AND awards.owner_user_id = ?
	`).run(id, name, createdAt, categoryId, userId);
	return result.changes === 1;
}

export function updateNominee(userId: number, awardId: string, nomineeId: string, name: string): boolean {
	const result = database.prepare(`
		UPDATE nominees
		SET name = ?
		WHERE id = ? AND category_id IN (
			SELECT categories.id
			FROM categories
			JOIN awards ON awards.id = categories.award_id
			WHERE awards.id = ? AND awards.owner_user_id = ?
		)
	`).run(name, nomineeId, awardId, userId);
	return result.changes === 1;
}

export function deleteCategory(
	userId: number,
	awardId: string,
	categoryId: string
): { videos: Pick<Video, "id" | "mime_type">[]; uploadIds: string[] } | null {
	const remove = database.transaction(() => {
		const category = database.prepare(`
			SELECT categories.id
			FROM categories
			JOIN awards ON awards.id = categories.award_id
			WHERE categories.id = ? AND awards.id = ? AND awards.owner_user_id = ?
		`).get(categoryId, awardId, userId);

		if (!category)
			return null;

		const videos = database.prepare(`
			SELECT videos.id, videos.mime_type
			FROM videos
			JOIN nominees ON nominees.id = videos.nominee_id
			WHERE nominees.category_id = ?
		`).all(categoryId) as Pick<Video, "id" | "mime_type">[];

		const uploads = database.prepare(`
			SELECT video_uploads.id
			FROM video_uploads
			JOIN nominees ON nominees.id = video_uploads.nominee_id
			WHERE nominees.category_id = ?
		`).all(categoryId) as { id: string }[];

		const result = database.prepare(`
			DELETE FROM categories
			WHERE id = ? AND award_id = ?
		`).run(categoryId, awardId);

		if (result.changes !== 1)
			return null;

		return { videos, uploadIds: uploads.map((upload) => upload.id) };
	});

	return remove.immediate();
}

export function deleteNominee(
	userId: number,
	awardId: string,
	nomineeId: string
): { videos: Pick<Video, "id" | "mime_type">[]; uploadIds: string[] } | null {
	const remove = database.transaction(() => {
		const nominee = database.prepare(`
			SELECT nominees.id
			FROM nominees
			JOIN categories ON categories.id = nominees.category_id
			JOIN awards ON awards.id = categories.award_id
			WHERE nominees.id = ? AND awards.id = ? AND awards.owner_user_id = ?
		`).get(nomineeId, awardId, userId);

		if (!nominee)
			return null;

		const videos = database.prepare(`
			SELECT id, mime_type
			FROM videos
			WHERE nominee_id = ?
		`).all(nomineeId) as Pick<Video, "id" | "mime_type">[];

		const uploads = database.prepare(`
			SELECT id
			FROM video_uploads
			WHERE nominee_id = ?
		`).all(nomineeId) as { id: string }[];

		database.prepare("DELETE FROM nominees WHERE id = ?").run(nomineeId);
		return { videos, uploadIds: uploads.map((upload) => upload.id) };
	});

	return remove.immediate();
}
