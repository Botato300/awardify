<script lang="ts">
	import { enhance, type SubmitFunction } from "$app/forms";
	import type { PageProps } from "./$types";
	import EditNomineeDialog from "../../../components/EditNomineeDialog.svelte";
	import NomineeDialog from "../../../components/NomineeDialog.svelte";
	import VideoUploader from "../../../components/VideoUploader.svelte";
	import type { Nominee, Video } from "../../../models/award";

	type ManagedNominee = Nominee & { videos: Video[] };
	type PendingNominee = { categoryId: string; nominee: Nominee; file: File };
	type PendingVideoReplacement = { nomineeId: string; file: File };
	type DisplayNominee = ManagedNominee & { initialFile: File | null };
	type CategoryWithNominees = { id: string; nominees: ManagedNominee[] };

	let { data, form }: PageProps = $props();
	let deleteDialog: HTMLDialogElement;
	let deleteCategoryDialog: HTMLDialogElement;
	let nomineeToDelete = $state<{ id: string; name: string } | null>(null);
	let categoryToDelete = $state<{ id: string; name: string } | null>(null);
	let pendingNominees = $state<PendingNominee[]>([]);
	let pendingVideoReplacements = $state<PendingVideoReplacement[]>([]);
	let nomineeNameOverrides = $state<Record<string, string>>({});
	let uploadingNomineeIds = $state<string[]>([]);

	function confirmDeleteNominee(nominee: { id: string; name: string }): void {
		nomineeToDelete = nominee;
		deleteDialog.showModal();
	}

	function confirmDeleteCategory(category: { id: string; name: string }): void {
		categoryToDelete = category;
		deleteCategoryDialog.showModal();
	}

	function addPendingNominee(categoryId: string, nominee: Nominee, file: File): void {
		pendingNominees = [...pendingNominees, { categoryId, nominee, file }];
		setNomineeUploading(nominee.id, true);
	}

	function getVisibleNominees(category: CategoryWithNominees): DisplayNominee[] {
		const nominees = category.nominees.map((nominee) => ({
			...nominee,
			name: nomineeNameOverrides[nominee.id] ?? nominee.name,
			initialFile: pendingNominees.find((pending) => pending.nominee.id === nominee.id)?.file ?? pendingVideoReplacements.find((pending) => pending.nomineeId === nominee.id)?.file ?? null,
		}));

		for (const pending of pendingNominees) {
			if (pending.categoryId === category.id && !nominees.some((nominee) => nominee.id === pending.nominee.id))
				nominees.push({ ...pending.nominee, videos: [], initialFile: pending.file });
		}

		return nominees;
	}

	function setNomineeUploading(nomineeId: string, isUploading: boolean): void {
		if (isUploading && !uploadingNomineeIds.includes(nomineeId)) uploadingNomineeIds = [...uploadingNomineeIds, nomineeId];

		if (!isUploading) uploadingNomineeIds = uploadingNomineeIds.filter((id) => id !== nomineeId);
	}

	function finishInitialUpload(nomineeId: string): void {
		pendingNominees = pendingNominees.filter((pending) => pending.nominee.id !== nomineeId);
		pendingVideoReplacements = pendingVideoReplacements.filter((pending) => pending.nomineeId !== nomineeId);
		setNomineeUploading(nomineeId, false);
	}

	function updateNominee(nominee: { id: string; name: string }, video: File | null): void {
		nomineeNameOverrides = { ...nomineeNameOverrides, [nominee.id]: nominee.name };
		if (!video)
			return;

		pendingVideoReplacements = [
			...pendingVideoReplacements.filter((pending) => pending.nomineeId !== nominee.id),
			{ nomineeId: nominee.id, file: video }
		];
		setNomineeUploading(nominee.id, true);
	}

	const enhanceNomineeDeletion: SubmitFunction = () => {
		return async ({ result, update }) => {
			if (result.type === "success") deleteDialog.close();

			await update();
		};
	};

	const enhanceCategoryDeletion: SubmitFunction = () => {
		return async ({ result, update }) => {
			if (result.type === "success") {
				deleteCategoryDialog.close();
				categoryToDelete = null;
			}

			await update();
		};
	};
</script>

<svelte:head>
	<title>{data.award.name} | Awardify</title>
</svelte:head>

<section class="mx-auto min-w-0 w-full max-w-5xl flex-1 p-6 md:p-10">
	<a href="/" class="link">← Mis awards</a>
	<h1 class="mt-4 truncate text-3xl font-bold">{data.award.name}</h1>

	{#if form?.message}
		<p class="alert alert-error mt-6" role="alert">{form.message}</p>
	{/if}

	<form method="POST" action="?/createCategory" use:enhance class="card mt-8 border border-base-300 bg-base-100 shadow-sm">
		<div class="card-body gap-4">
			<h2 class="card-title">Crear categoría</h2>
			<div class="flex flex-col gap-3 sm:flex-row">
				<input class="input input-bordered w-full" type="text" name="name" placeholder="Nombre de la categoría" required maxlength="100" />
				<button class="btn btn-primary sm:w-auto" type="submit">Agregar categoría</button>
			</div>
		</div>
	</form>

	{#if data.award.categories.length === 0}
		<div class="card mt-8 border border-base-300 bg-base-100 shadow-sm">
			<div class="card-body items-center py-12 text-center">
				<h2 class="card-title">Todavía no hay categorías</h2>
				<p>Crea una categoría para empezar a agregar nominados.</p>
			</div>
		</div>
	{:else}
		<div class="mt-8 flex flex-col gap-6">
			{#each data.award.categories as category (category.id)}
				{@const visibleNominees = getVisibleNominees(category)}
				{@const isCategoryUploading = visibleNominees.some((nominee) => uploadingNomineeIds.includes(nominee.id))}
				<section class="card min-w-0 w-full border border-base-300 bg-base-100 shadow-sm">
					<div class="card-body min-w-0 gap-5">
						<div class="flex flex-wrap items-center justify-between gap-4">
							<h2 class="card-title min-w-0 flex-1"><span class="block min-w-0 truncate">{category.name}</span></h2>
							<div class="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
								<NomineeDialog {category} onCreated={(nominee, file) => addPendingNominee(category.id, nominee, file)} />
								<button
									class="btn btn-outline btn-error btn-sm"
									type="button"
									disabled={isCategoryUploading}
									aria-label={`Eliminar categoría ${category.name}`}
									onclick={() => confirmDeleteCategory(category)}>Eliminar categoría</button
								>
							</div>
							{#if isCategoryUploading}
								<p class="w-full text-right text-sm text-gray-500">Espera a que termine la subida para eliminar la categoría.</p>
							{/if}
						</div>

						{#if visibleNominees.length === 0}
							<p class="text-sm text-gray-500">Todavía no hay nominados.</p>
						{:else}
							<div class="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
								{#each visibleNominees as nominee (nominee.id)}
									<article class="card min-w-0 w-full border border-base-300 bg-base-100 shadow-sm">
										<div class="card-body min-w-0 gap-3 p-4">
											<div class="flex items-start justify-between gap-3">
												<h3 class="card-title min-w-0 flex-1 text-base"><span class="block min-w-0 truncate">{nominee.name}</span></h3>
												<EditNomineeDialog
													{category}
													{nominee}
													videos={nominee.videos}
													disabled={uploadingNomineeIds.includes(nominee.id)}
													onEdited={updateNominee}
												/>
												<button
													class="btn btn-ghost btn-sm shrink-0 text-error"
													type="button"
													disabled={uploadingNomineeIds.includes(nominee.id)}
													aria-label={`Eliminar nominado ${nominee.name}`}
													onclick={() => confirmDeleteNominee(nominee)}>Eliminar</button
												>
											</div>
											<VideoUploader
												nomineeId={nominee.id}
												videos={nominee.videos}
												initialFile={nominee.initialFile}
												onUploadingChange={setNomineeUploading}
												onInitialUploadFinished={finishInitialUpload}
											/>
										</div>
									</article>
								{/each}
							</div>
						{/if}
					</div>
				</section>
			{/each}
		</div>
	{/if}
</section>

<dialog bind:this={deleteCategoryDialog} class="modal" aria-labelledby="delete-category-title">
	<div class="modal-box">
		<h2 id="delete-category-title" class="text-lg font-bold">Eliminar categoría</h2>
		<p class="pt-4">¿Seguro que quieres eliminar esta categoría?</p>
		<p class="truncate font-semibold">{categoryToDelete?.name}</p>
		<p>También se eliminarán todos sus nominados, videos y subidas pendientes.</p>
		{#if form?.categoryDeleteMessage}
			<p class="alert alert-error" role="alert">{form.categoryDeleteMessage}</p>
		{/if}
		<div class="modal-action flex-wrap">
			<form method="dialog">
				<button class="btn" type="submit">Cancelar</button>
			</form>
			<form method="POST" action="?/deleteCategory" use:enhance={enhanceCategoryDeletion}>
				<input type="hidden" name="categoryId" value={categoryToDelete?.id ?? ""} />
				<button class="btn btn-error" type="submit" disabled={!categoryToDelete}>Eliminar categoría</button>
			</form>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button aria-label="Cerrar diálogo">Cerrar</button>
	</form>
</dialog>

<dialog bind:this={deleteDialog} class="modal" aria-labelledby="delete-nominee-title">
	<div class="modal-box">
		<h2 id="delete-nominee-title" class="text-lg font-bold">Eliminar nominado</h2>
		<p class="pt-4">¿Seguro que quieres eliminar este nominado?</p>
		<p class="truncate font-semibold">{nomineeToDelete?.name}</p>
		<p>También se eliminará el video asociado.</p>
		<div class="modal-action flex-wrap">
			<form method="dialog">
				<button class="btn" type="submit">Cancelar</button>
			</form>
			<form method="POST" action="?/deleteNominee" use:enhance={enhanceNomineeDeletion}>
				<input type="hidden" name="nomineeId" value={nomineeToDelete?.id ?? ""} />
				<button class="btn btn-error" type="submit" disabled={!nomineeToDelete}>Eliminar</button>
			</form>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button aria-label="Cerrar diálogo">Cerrar</button>
	</form>
</dialog>
