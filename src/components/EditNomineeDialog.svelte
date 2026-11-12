<script lang="ts">
	import { enhance, type SubmitFunction } from "$app/forms";
	import type { Nominee, Video } from "../models/award";
	import { MAX_VIDEO_SIZE } from "../services/video-upload-limits";

	let {
		category,
		nominee,
		videos,
		disabled,
		onEdited,
	}: {
		category: { id: string; name: string };
		nominee: Nominee;
		videos: Video[];
		disabled: boolean;
		onEdited: (nominee: { id: string; name: string }, video: File | null) => void;
	} = $props();

	let dialog: HTMLDialogElement;
	let videoInput: HTMLInputElement;
	let nomineeName = $state("");
	let selectedVideo = $state<File | null>(null);
	let previewUrl = $state<string | null>(null);
	let message = $state("");

	function openDialog(): void {
		nomineeName = nominee.name;
		selectedVideo = null;
		message = "";
		clearPreview();
		videoInput.value = "";
		dialog.showModal();
	}

	function selectVideo(event: Event): void {
		const input = event.currentTarget as HTMLInputElement;
		selectedVideo = input.files?.[0] ?? null;
		clearPreview();
		if (selectedVideo) previewUrl = URL.createObjectURL(selectedVideo);
		message = selectedVideo && selectedVideo.size > MAX_VIDEO_SIZE ? "El video supera el límite de 300 MB." : "";
	}

	function clearPreview(): void {
		if (previewUrl) URL.revokeObjectURL(previewUrl);

		previewUrl = null;
	}

	function resetForm(): void {
		clearPreview();
		selectedVideo = null;
		message = "";
		videoInput.value = "";
	}

	function openVideoPicker(): void {
		videoInput.click();
	}

	const enhanceNomineeUpdate: SubmitFunction = ({ cancel }) => {
		if (selectedVideo && selectedVideo.size > MAX_VIDEO_SIZE) {
			message = "El video supera el límite de 300 MB.";
			cancel();
			return;
		}

		message = "";

		return async ({ result, update }) => {
			if (result.type === "success") {
				const data = result.data as { nominee: { id: string; name: string } };
				onEdited(data.nominee, selectedVideo);
				dialog.close();
			} else if (result.type === "failure") {
				const data = result.data as { nomineeEditMessage?: string };
				message = data.nomineeEditMessage ?? "No se pudo actualizar el nominado.";
			}

			await update({ refreshAll: false });
		};
	};
</script>

<button class="btn btn-ghost btn-sm shrink-0" type="button" {disabled} aria-label={`Editar nominado ${nominee.name}`} onclick={openDialog}>Editar</button>

<dialog bind:this={dialog} class="modal" aria-labelledby={`edit-nominee-title-${nominee.id}`} onclose={resetForm}>
	<div class="modal-box">
		<h2 id={`edit-nominee-title-${nominee.id}`} class="text-lg font-bold">Editar nominado</h2>
		<p class="mt-1 truncate text-sm text-gray-500">Categoría: {category.name}</p>

		{#if message}
			<p class="alert alert-error mt-4" role="alert">{message}</p>
		{/if}

		<form method="POST" action="?/editNominee" use:enhance={enhanceNomineeUpdate} class="mt-4 flex flex-col gap-4">
			<input type="hidden" name="nomineeId" value={nominee.id} />
			<label class="form-control w-full">
				<span class="label-text mb-2">Nombre del nominado</span>
				<input class="input input-bordered w-full" type="text" name="name" bind:value={nomineeName} required maxlength="100" />
			</label>
			<input bind:this={videoInput} class="hidden" type="file" accept="video/mp4,video/webm,.mp4,.webm" onchange={selectVideo} />
			<div class="flex flex-col gap-2">
				{#if selectedVideo && previewUrl}
					<p class="text-sm text-gray-500">Vista previa del nuevo video</p>
					<video
						class="aspect-video w-full rounded-box bg-neutral"
						controls
						muted
						controlslist="nodownload noplaybackrate"
						disablepictureinpicture
						preload="metadata"
						aria-label="Vista previa del video seleccionado"
					>
						<source src={previewUrl} />
					</video>
				{:else if videos.length > 0}
					<p class="text-sm text-gray-500">Video actual</p>
					{#each videos as video (video.id)}
						<video
							class="aspect-video w-full rounded-box bg-neutral"
							controls
							muted
							controlslist="nodownload noplaybackrate"
							disablepictureinpicture
							preload="metadata"
							aria-label="Video actual del nominado"
						>
							<source src={`/media/${video.id}`} type={video.mime_type} />
						</video>
					{/each}
				{:else}
					<p class="text-sm text-gray-500">Este nominado todavía no tiene un video.</p>
				{/if}

				<button class="btn btn-outline self-center" type="button" onclick={openVideoPicker}>Cambiar video</button>
				<p class="text-center text-sm text-gray-500">Solo se permiten videos en formato .mp4 o .webm de hasta 300 MB</p>
			</div>
			<div class="modal-action flex-wrap">
				<button class="btn" type="button" onclick={() => dialog.close()}>Cancelar</button>
				<button class="btn btn-primary" type="submit" disabled={!nomineeName.trim() || Boolean(selectedVideo && selectedVideo.size > MAX_VIDEO_SIZE)}
					>Guardar cambios</button
				>
			</div>
		</form>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button aria-label="Cerrar diálogo">Cerrar</button>
	</form>
</dialog>
