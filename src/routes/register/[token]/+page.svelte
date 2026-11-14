<script lang="ts">
	import { enhance } from "$app/forms";
	import type { PageProps } from "./$types";

	let { form }: PageProps = $props();
</script>

<svelte:head>
	<title>Crear cuenta | Awardify</title>
</svelte:head>

<section class="flex flex-1 items-center justify-center p-6">
	<form method="POST" use:enhance class="card bg-base-100 w-full max-w-md shadow-xl">
		<div class="card-body gap-4">
			<h1 class="card-title text-2xl">Crear cuenta</h1>

			<p>Esta invitación permite crear una cuenta para usar la plataforma.</p>

			{#if form?.message}
				<p class="alert alert-error" role="alert">{form.message}</p>
			{/if}

			<label class="form-control w-full">
				<span class="block mb-1">Correo electrónico</span>
				<input
					class="input input-bordered w-full"
					type="email"
					name="email"
					placeholder="Ingrese su correo electrónico"
					autocomplete="email"
					required
					maxlength="254"
					value={form?.email ?? ""}
				/>
			</label>

			<label class="form-control w-full">
				<span class="block mb-1">Contraseña</span>
				<input
					class="input input-bordered w-full"
					type="password"
					name="password"
					placeholder="Ingrese su contraseña"
					autocomplete="new-password"
					required
					minlength="4"
					maxlength="1024"
				/>
			</label>

			<button class="btn btn-primary mt-2" type="submit">Crear cuenta</button>
		</div>
	</form>
</section>
