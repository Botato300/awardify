<script lang="ts">
	import { enhance, type SubmitFunction } from "$app/forms";

	let {
		award,
		onEdited,
	}: {
		award: { id: string; name: string };
		onEdited: (award: { id: string; name: string }) => void;
	} = $props();

	let dialog: HTMLDialogElement;
	let awardName = $state("");
	let message = $state("");

	function openDialog(): void {
		awardName = award.name;
		message = "";
		dialog.showModal();
	}

	const enhanceAwardUpdate: SubmitFunction = () => {
		message = "";

		return async ({ result, update }) => {
			if (result.type === "success" && result.data?.award) {
				const data = result.data as { award: { id: string; name: string } };
				onEdited(data.award);
				dialog.close();
			} else if (result.type === "failure") {
				const data = result.data as { awardEditMessage?: string } | undefined;
				message = data?.awardEditMessage ?? "No se pudo actualizar el award. Intenta de nuevo.";
			}

			await update({ refreshAll: false });
		};
	};
</script>

<button class="btn btn-ghost btn-sm pointer-events-auto" type="button" aria-label={`Editar award ${award.name}`} onclick={openDialog}>Editar</button>

<dialog bind:this={dialog} class="modal pointer-events-auto" aria-labelledby={`edit-award-title-${award.id}`}>
	<div class="modal-box">
		<h2 id={`edit-award-title-${award.id}`} class="text-lg font-bold">Editar award</h2>

		{#if message}
			<p class="alert alert-error mt-4" role="alert">{message}</p>
		{/if}

		<form method="POST" action="?/editAward" use:enhance={enhanceAwardUpdate} class="mt-4 flex flex-col gap-4">
			<input type="hidden" name="awardId" value={award.id} />
			<label class="form-control w-full">
				<span class="label-text mb-2">Nombre del award</span>
				<input class="input input-bordered w-full" type="text" name="name" bind:value={awardName} required maxlength="100" />
			</label>
			<div class="modal-action flex-wrap">
				<button class="btn" type="button" onclick={() => dialog.close()}>Cancelar</button>
				<button class="btn btn-primary" type="submit" disabled={!awardName.trim()}>Guardar cambios</button>
			</div>
		</form>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button aria-label="Cerrar diálogo">Cerrar</button>
	</form>
</dialog>
