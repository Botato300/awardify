<script lang="ts">
	import { enhance } from "$app/forms";
	import type { PageProps } from "./$types";

	let { form }: PageProps = $props();
</script>

<svelte:head>
	<title>Iniciar sesión | Awardify</title>
</svelte:head>

<section class="flex flex-1 items-center justify-center p-6">
	<form method="POST" use:enhance class="card bg-base-100 w-full max-w-md shadow-xl">
		<div class="card-body gap-4">
			<h1 class="card-title text-2xl">Iniciar sesión</h1>

			{#if form?.message}
				<p class="alert alert-error" role="alert">{form.message}</p>
			{/if}

			<label class="form-control w-full">
				<span class="label-text mb-2">Email</span>
				<input class="input input-bordered w-full" type="email" name="email" autocomplete="email" required maxlength="254" value={form?.email ?? ""} />
			</label>

			<label class="form-control w-full">
				<span class="label-text mb-2">Contraseña</span>
				<input class="input input-bordered w-full" type="password" name="password" autocomplete="current-password" required maxlength="1024" />
			</label>

			<button class="btn btn-primary mt-2" type="submit">Entrar</button>
		</div>
	</form>
</section>
