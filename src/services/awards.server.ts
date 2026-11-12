import { randomUUID } from "node:crypto";
import type { Nominee } from "../models/award";
import { deleteAward as deleteAwardRecord, deleteCategory as deleteCategoryRecord, deleteNominee as deleteNomineeRecord, insertAward, insertCategory, insertNominee, listAwards, updateAward as updateAwardRecord, updateCategory as updateCategoryRecord, updateNominee as updateNomineeRecord } from "../models/awards.server";
import { removeVideoFiles } from "./video-uploads.server";

export class AwardError extends Error { }

function withUniqueConstraintMessage<T>(operation: () => T, message: string): T {
	try {
		return operation();
	} catch (error) {
		if (typeof error === "object" && error !== null && "code" in error && error.code === "SQLITE_CONSTRAINT_UNIQUE")
			throw new AwardError(message);

		throw error;
	}
}

export function getAwards(userId: number) {
	return listAwards(userId);
}

export function createAward(userId: number, name: string): string {
	const cleanName = name.trim();
	if (!cleanName || cleanName.length > 100)
		throw new AwardError("El nombre del award debe tener entre 1 y 100 caracteres.");

	const awardId = randomUUID();
	insertAward(awardId, userId, cleanName, Date.now());

	return awardId;
}

export function renameAward(userId: number, awardId: string, name: string): void {
	const cleanName = name.trim();
	if (!cleanName || cleanName.length > 100)
		throw new AwardError("El nombre del award debe tener entre 1 y 100 caracteres.");

	if (!updateAwardRecord(userId, awardId, cleanName))
		throw new AwardError("No se encontró el award o no tienes permiso para modificarlo.");
}

export async function removeAward(userId: number, awardId: string): Promise<boolean> {
	const deleted = deleteAwardRecord(userId, awardId);
	if (!deleted)
		return false;

	await removeVideoFiles(deleted.videos, deleted.uploadIds);

	return true;
}

export async function removeCategory(userId: number, awardId: string, categoryId: string): Promise<boolean> {
	const deleted = deleteCategoryRecord(userId, awardId, categoryId);
	if (!deleted)
		return false;

	await removeVideoFiles(deleted.videos, deleted.uploadIds);

	return true;
}

export function createCategory(userId: number, awardId: string, name: string): void {
	const cleanName = name.trim();
	if (!cleanName || cleanName.length > 100)
		throw new AwardError("El nombre de la categoría debe tener entre 1 y 100 caracteres.");

	if (!withUniqueConstraintMessage(
		() => insertCategory(randomUUID(), userId, awardId, cleanName, Date.now()),
		"Ya existe una categoría con ese nombre."
	))
		throw new AwardError("No se encontró el award o no tienes permiso para modificarlo.");
}

export function renameCategory(userId: number, awardId: string, categoryId: string, name: string): void {
	const cleanName = name.trim();
	if (!cleanName || cleanName.length > 100)
		throw new AwardError("El nombre de la categoría debe tener entre 1 y 100 caracteres.");

	if (!withUniqueConstraintMessage(
		() => updateCategoryRecord(userId, awardId, categoryId, cleanName),
		"Ya existe una categoría con ese nombre."
	))
		throw new AwardError("No se encontró la categoría o no tienes permiso para modificarla.");
}

export function createNominee(userId: number, categoryId: string, name: string): Nominee {
	const cleanName = name.trim();
	if (!cleanName || cleanName.length > 100)
		throw new AwardError("El nombre del nominado debe tener entre 1 y 100 caracteres.");

	const nominee = { id: randomUUID(), name: cleanName, created_at: Date.now() };
	if (!withUniqueConstraintMessage(
		() => insertNominee(nominee.id, userId, categoryId, cleanName, nominee.created_at),
		"Ya existe un nominado con ese nombre en esta categoría."
	))
		throw new AwardError("No se encontró la categoría o no tienes permiso para modificarla.");

	return nominee;
}

export function renameNominee(userId: number, awardId: string, nomineeId: string, name: string): void {
	const cleanName = name.trim();
	if (!cleanName || cleanName.length > 100)
		throw new AwardError("El nombre del nominado debe tener entre 1 y 100 caracteres.");

	if (!withUniqueConstraintMessage(
		() => updateNomineeRecord(userId, awardId, nomineeId, cleanName),
		"Ya existe un nominado con ese nombre en esta categoría."
	))
		throw new AwardError("No se encontró el nominado o no tienes permiso para modificarlo.");
}

export async function removeNominee(userId: number, awardId: string, nomineeId: string): Promise<boolean> {
	const deleted = deleteNomineeRecord(userId, awardId, nomineeId);
	if (!deleted)
		return false;

	await removeVideoFiles(deleted.videos, deleted.uploadIds);

	return true;
}
