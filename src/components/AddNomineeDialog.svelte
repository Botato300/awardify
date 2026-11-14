<script lang="ts">
	import { onMount } from "svelte";
	import { enhance, type SubmitFunction } from "$app/forms";

	import PlusIcon from "phosphor-svelte/lib/PlusIcon";
	import UploadSimpleIcon from "phosphor-svelte/lib/UploadSimpleIcon";

	import type { Nominee } from "../models/award";

	import { MAX_VIDEO_SIZE } from "../services/video-upload-limits";

	let {
		category,
		onCreated,
	}: {
		category: { id: string; name: string };
		onCreated: (nominee: Nominee, video: File) => void;
	} = $props();

	let dialog: HTMLDialogElement;
	let videoInput: HTMLInputElement;
	let nomineeName = $state("");
	let selectedVideo = $state<File | null>(null);
	let previewUrl = $state<string | null>(null);
	let message = $state("");

	onMount(() => clearPreview);

	function openDialog(): void {
		resetForm();
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
		nomineeName = "";
		selectedVideo = null;
		message = "";
		videoInput.value = "";
	}

	function openVideoPicker(): void {
		videoInput.click();
	}

	const enhanceNomineeCreation: SubmitFunction = ({ formData, cancel }) => {
		const video = selectedVideo;
		if (!video) {
			message = "Selecciona un video para continuar.";
			cancel();
			return;
		}

		if (video.size > MAX_VIDEO_SIZE) {
			message = "El video supera el límite de 300 MB.";
			cancel();
			return;
		}

		formData.delete("video");
		message = "";

		return async ({ result, update }) => {
			if (result.type === "success") {
				const data = result.data as { nominee: Nominee };
				onCreated(data.nominee, video);
				dialog.close();
			} else if (result.type === "failure") {
				const data = result.data as { message?: string };
				message = data.message ?? "No se pudo crear el nominado.";
			}

			await update();
		};
	};
</script>

<button class="btn btn-secondary btn-sm shrink-0 items-center" type="button" onclick={openDialog}>
	<PlusIcon size="1rem" />
	Agregar nominado
</button>

<dialog bind:this={dialog} class="modal" aria-labelledby={`add-nominee-title-${category.id}`} onclose={resetForm}>
	<div class="modal-box">
		<h2 id={`add-nominee-title-${category.id}`} class="text-lg font-bold">Agregar nominado</h2>
		<p class="mt-1 truncate text-sm text-gray-500">Categoría: {category.name}</p>

		{#if message}
			<p class="alert alert-error mt-4" role="alert">{message}</p>
		{/if}

		<form method="POST" action="?/createNominee" enctype="multipart/form-data" use:enhance={enhanceNomineeCreation} class="mt-4 flex flex-col gap-4">
			<input type="hidden" name="categoryId" value={category.id} />
			<input type="hidden" name="videoSelected" value={selectedVideo ? "true" : "false"} />
			<label class="form-control w-full">
				<span class="block mb-1">Nombre del nominado</span>
				<input class="input input-bordered w-full" type="text" name="name" bind:value={nomineeName} required maxlength="100" />
			</label>
			<input bind:this={videoInput} class="hidden" type="file" name="video" accept="video/mp4,video/webm,.mp4,.webm" onchange={selectVideo} />
			<div class="flex flex-col gap-2">
				<button class="btn btn-outline self-center items-center" type="button" onclick={openVideoPicker}>
					<UploadSimpleIcon size="1.2rem" />
					Seleccionar video
				</button>

				<p class="text-sm text-gray-500 text-center">Solo se permiten videos en formato .mp4 o .webm de hasta 300 MB</p>

				{#if selectedVideo}
					<p class="text-sm text-gray-500">Video seleccionado</p>
					{#if previewUrl}
						<video
							class="aspect-video w-full rounded-box bg-black"
							controls
							muted
							controlslist="nodownload noplaybackrate"
							disablepictureinpicture
							preload="metadata"
							aria-label="Vista previa del video seleccionado"
						>
							<source src={previewUrl} />
						</video>
					{/if}
				{/if}
			</div>
			<div class="modal-action flex-wrap">
				<button class="btn" type="button" onclick={() => dialog.close()}>Cancelar</button>
				<button class="btn btn-primary" type="submit" disabled={!nomineeName.trim() || !selectedVideo || selectedVideo.size > MAX_VIDEO_SIZE}>Crear nominado</button>
			</div>
		</form>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button aria-label="Cerrar diálogo">Cerrar</button>
	</form>
</dialog>
