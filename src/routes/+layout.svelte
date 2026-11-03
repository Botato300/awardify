<script lang="ts">
	import type { LayoutProps } from "./$types";

	let { children }: LayoutProps = $props();
</script>

<header>
	<a href="/">Awardify</a>
</header>

<main>
	{@render children()}
</main>

<footer>
	<p>Hecho por <a href="https://tomasbottari.com/">Tomás Bottari</a></p>
</footer>
