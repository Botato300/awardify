<script lang="ts">
	import { enhance } from "$app/forms";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Mis awards | Awardify</title>
</svelte:head>

<section class="mx-auto w-full max-w-5xl flex-1 p-6 md:p-10">
	<div class="flex flex-wrap items-center justify-between gap-4">
		<div>
			<h1 class="text-3xl font-bold">Mis awards</h1>
			<p class="mt-2">Sesión iniciada como {data.user.email}</p>
		</div>

		<form method="POST" action="?/logout" use:enhance>
			<button class="btn btn-outline" type="submit">Cerrar sesión</button>
		</form>
	</div>

	<div class="card mt-8 border border-base-300 bg-base-100 shadow-sm">
		<div class="card-body items-center py-14 text-center">
			<h2 class="card-title">Todavía no tienes awards</h2>
			<p>Cuando esté disponible la creación de awards, los que crees aparecerán aquí.</p>
		</div>
	</div>
</section>
