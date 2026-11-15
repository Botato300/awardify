<script lang="ts">
	import type { Snippet } from "svelte";

	interface Props {
		label: string;
		trigger: Snippet;
		menu: Snippet<[close: () => void]>;
	}

	let { label, trigger, menu }: Props = $props();
	let isOpen = $state(false);
	let dropdown: HTMLDivElement;

	function close(): void {
		isOpen = false;
	}

	function handleWindowClick(event: MouseEvent): void {
		if (event.target instanceof Node && !dropdown.contains(event.target)) close();
	}

	function handleWindowKeydown(event: KeyboardEvent): void {
		if (event.key !== "Escape" || !isOpen) return;

		close();
		dropdown.querySelector("button")?.focus();
	}
</script>

<svelte:window onclick={handleWindowClick} onkeydown={handleWindowKeydown} />

<div bind:this={dropdown} class="dropdown dropdown-end" class:dropdown-open={isOpen}>
	<button class="btn btn-ghost btn-sm btn-square" type="button" aria-label={label} aria-expanded={isOpen} onclick={() => (isOpen = !isOpen)}>
		{@render trigger()}
	</button>
	{#if isOpen}
		<ul class="menu dropdown-menu dropdown-content z-10 mt-2 w-48 rounded-box border border-base-content/20 bg-base-200 p-0 shadow-2xl">
			{@render menu(close)}
		</ul>
	{/if}
</div>

<style>
	:global(.dropdown-menu button:not(:disabled)),
	:global(.dropdown-menu a[href]) {
		cursor: pointer;
	}

	.dropdown-menu {
		/* daisyUI may rename these internal menu tokens; this may stop working when you update to a new version */
		--menu-active-bg: var(--color-base-300);
		--menu-active-fg: var(--color-base-content);
	}
</style>
