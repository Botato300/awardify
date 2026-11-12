<script lang="ts">
	import { onMount } from "svelte";
	import { refreshAll } from "$app/navigation";
	import type { Video } from "../models/award";
	import { MAX_VIDEO_SIZE } from "../services/video-upload-limits";

	class UploadRequestError extends Error {}

	let {
		nomineeId,
		videos,
		initialFile = null,
		onUploadingChange,
		onInitialUploadFinished,
	}: {
		nomineeId: string;
		videos: Video[];
		initialFile?: File | null;
		onUploadingChange?: (nomineeId: string, isUploading: boolean) => void;
		onInitialUploadFinished?: (nomineeId: string) => void;
	} = $props();

	let isUploading = $state(false);
	let isBusy = $derived(isUploading || Boolean(initialFile));
	let progress = $state(0);
	let message = $state("");
	let previewUrl = $state<string | null>(null);

	let lastInitialFile: File | null = null;

	$effect(() => {
		const file = initialFile;
		if (!file || file === lastInitialFile)
			return;

		lastInitialFile = file;
		setPreview(file);
		void uploadFile(file, true);
	});

	onMount(() => clearPreview);

	async function readError(response: Response): Promise<string> {
		const result = (await response.json().catch(() => null)) as { message?: string } | null;
		return result?.message ?? "No se pudo completar la operación.";
	}

	function setPreview(file: File): void {
		clearPreview();
		previewUrl = URL.createObjectURL(file);
	}

	function clearPreview(): void {
		if (previewUrl) URL.revokeObjectURL(previewUrl);

		previewUrl = null;
	}

	async function uploadFile(file: File, initialUpload = false): Promise<void> {
		if (file.size > MAX_VIDEO_SIZE) {
			message = "El tamaño máximo permitido por video es 300 MB.";
			clearPreview();
			isUploading = false;
			onUploadingChange?.(nomineeId, false);
			if (initialUpload) {
				await refreshAll().catch(() => undefined);
				onInitialUploadFinished?.(nomineeId);
			}

			return;
		}

		isUploading = true;
		onUploadingChange?.(nomineeId, true);
		progress = 0;
		message = "Preparando la subida...";
		let uploadId: string | null = null;
		let completed = false;
		let pageRefreshed = false;

		try {
			const createResponse = await fetch("/api/uploads", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					nomineeId,
					fileSize: file.size,
				}),
			});
			if (!createResponse.ok) throw new UploadRequestError(await readError(createResponse));

			const upload = (await createResponse.json()) as { id: string; chunkSize: number; chunkCount: number };
			uploadId = upload.id;
			message = "Subiendo video...";

			for (let index = 0; index < upload.chunkCount; index++) {
				const start = index * upload.chunkSize;
				const chunk = file.slice(start, Math.min(start + upload.chunkSize, file.size));
				const response = await fetch(`/api/uploads/${upload.id}/${index}`, {
					method: "PUT",
					headers: { "Content-Type": "application/octet-stream" },
					body: chunk,
				});
				if (!response.ok) throw new UploadRequestError(await readError(response));

				progress = Math.round(((index + 1) / upload.chunkCount) * 100);
			}

			message = "Verificando video...";
			const completeResponse = await fetch(`/api/uploads/${upload.id}/complete`, {
				method: "POST",
			});
			if (!completeResponse.ok) throw new UploadRequestError(await readError(completeResponse));

			completed = true;
			message = "";
			await refreshAll();
			pageRefreshed = true;
		} catch (error) {
			message = completed
				? "El video se subió, pero no se pudo actualizar la página. Recárgala para ver los cambios."
				: error instanceof UploadRequestError
					? error.message
					: "No se pudo subir el video. Comprueba tu conexión e inténtalo de nuevo.";
		} finally {
			if (uploadId && !completed) {
				await fetch(`/api/uploads/${uploadId}`, { method: "DELETE" }).catch(() => undefined);
			}
			if (initialUpload) {
				if (!pageRefreshed) {
					await refreshAll().catch(() => undefined);
					pageRefreshed = true;
				}
				onInitialUploadFinished?.(nomineeId);
			}

			isUploading = false;
			onUploadingChange?.(nomineeId, false);
		}
	}

</script>

<div class="mt-5 flex min-w-0 w-full flex-col gap-3">
	{#if previewUrl}
		<video
			class="aspect-video w-full max-w-full rounded-box bg-neutral"
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
		{#each videos as video (video.id)}
			<video
				class="aspect-video w-full max-w-full rounded-box bg-neutral"
				controls
				muted
				controlslist="nodownload noplaybackrate"
				disablepictureinpicture
				preload="metadata"
				aria-label="Video del nominado"
			>
				<source src={`/media/${video.id}`} type={video.mime_type} />
			</video>
		{/each}
	{:else if !isBusy}
		<p class="text-sm text-gray-500">Todavía no tiene videos.</p>
	{/if}

	{#if isBusy}
		<div class="flex items-center gap-3">
			<progress class="progress progress-primary w-full" value={progress} max="100"></progress>
			<span class="text-sm">{progress}%</span>
		</div>
	{/if}

	{#if message}
		<p class="text-sm" aria-live="polite">{message}</p>
	{/if}
</div>
