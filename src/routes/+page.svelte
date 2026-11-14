<script lang="ts">
	import { enhance, type SubmitFunction } from "$app/forms";
	import type { PageProps } from "./$types";
	import EditAwardDialog from "../components/EditAwardDialog.svelte";

	let { data, form }: PageProps = $props();
	let deleteDialog: HTMLDialogElement;
	let awardToDelete = $state<{ id: string; name: string } | null>(null);
	let awardNameOverrides = $state<Record<string, string>>({});

	function updateAwardName(award: { id: string; name: string }): void {
		awardNameOverrides = { ...awardNameOverrides, [award.id]: award.name };
	}

	function confirmDeleteAward(award: { id: string; name: string }): void {
		awardToDelete = award;
		deleteDialog.showModal();
	}

	const enhanceAwardDeletion: SubmitFunction = () => {
		return async ({ result, update }) => {
			if (result.type === "success") {
				deleteDialog.close();
				awardToDelete = null;
			}

			await update();
		};
	};
</script>

<svelte:head>
	<title>Mis awards | Awardify</title>
</svelte:head>

<section class="mx-auto min-w-0 w-full max-w-5xl flex-1 p-6 md:p-10">
	<div class="flex flex-wrap items-center justify-between gap-4">
		<div class="min-w-0">
			<h1 class="text-3xl font-bold">Mis awards</h1>
			<p class="mt-2 max-w-full truncate">Sesión iniciada como {data.user.email}</p>
		</div>

		<form method="POST" action="?/logout" use:enhance>
			<button class="btn btn-outline" type="submit">Cerrar sesión</button>
		</form>
	</div>

	<div class="mt-8 flex flex-col gap-6">
		<form method="POST" action="?/createAward" use:enhance class="card border border-base-300 bg-base-100 shadow-sm">
			<div class="card-body gap-4">
				<h2 class="card-title">Crear un award</h2>

				{#if form?.message}
					<p class="alert alert-error" role="alert">{form.message}</p>
				{/if}

				<div class="flex flex-col gap-3 sm:flex-row">
					<input class="input input-bordered w-full" type="text" name="name" placeholder="Nombre del award" required maxlength="100" value={form?.name ?? ""} />
					<button class="btn btn-primary sm:w-auto" type="submit">Crear</button>
				</div>
			</div>
		</form>

		{#if data.awards.length === 0}
			<div class="card border border-base-300 bg-base-100 shadow-sm">
				<div class="card-body items-center py-14 text-center">
					<h2 class="card-title">Todavía no tienes awards</h2>
					<p>Cuando crees uno, aparecerá aquí.</p>
				</div>
			</div>
		{:else}
			<div class="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
				{#each data.awards as award (award.id)}
					{@const visibleAward = { ...award, name: awardNameOverrides[award.id] ?? award.name }}
					<article class="card relative min-w-0 w-full border border-base-300 bg-base-100 shadow-sm transition hover:shadow-md">
						<a class="absolute inset-0 z-0 rounded-box link" href={`/awards/${award.id}`} aria-label={`Abrir award ${visibleAward.name}`}>
							<span class="sr-only">Abrir award {visibleAward.name}</span>
						</a>
						<div class="card-body min-w-0">
							<h2 class="card-title min-w-0 max-w-full"><span class="block min-w-0 max-w-full truncate">{visibleAward.name}</span></h2>
						</div>
						<div class="card-actions pointer-events-none relative z-10 justify-end px-6 pb-4">
							<EditAwardDialog award={visibleAward} onEdited={updateAwardName} />
							<button
								class="btn btn-outline btn-error btn-sm pointer-events-auto"
								type="button"
								aria-label={`Eliminar award ${visibleAward.name}`}
								onclick={() => confirmDeleteAward(visibleAward)}>Eliminar</button
							>
						</div>
					</article>
				{/each}
			</div>
		{/if}
	</div>
</section>

<dialog bind:this={deleteDialog} class="modal" aria-labelledby="delete-award-title">
	<div class="modal-box">
		<h2 id="delete-award-title" class="text-lg font-bold">Eliminar award</h2>
		<p class="pt-4">Award a eliminar: <span class="truncate font-semibold">{awardToDelete?.name}</span></p>
		<p>También se eliminarán sus categorías, nominados, y videos.</p>
		{#if form?.deleteMessage}
			<p class="alert alert-error" role="alert">{form.deleteMessage}</p>
		{/if}
		<div class="modal-action flex-wrap">
			<form method="dialog">
				<button class="btn" type="submit">Cancelar</button>
			</form>
			<form method="POST" action="?/deleteAward" use:enhance={enhanceAwardDeletion}>
				<input type="hidden" name="awardId" value={awardToDelete?.id ?? ""} />
				<button class="btn btn-error" type="submit" disabled={!awardToDelete}>Eliminar award</button>
			</form>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button aria-label="Cerrar diálogo">Cerrar</button>
	</form>
</dialog>
