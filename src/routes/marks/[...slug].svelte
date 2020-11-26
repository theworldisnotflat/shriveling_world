<script context="module">
	export async function preload({ params }) {
		const res = await this.fetch(`marks/${params.slug.join('/')}.json`);
		const article = await res.json();
		return { article };
	}
</script>

<script>
	import 'tocbot/dist/tocbot.css';
	import Menu from '../../components/menu.svelte';
	import { onMount, afterUpdate } from 'svelte';
	export let article;
	let aside;
	const options = {
		tocSelector: '#toc',
		contentSelector: '#content',
		headingSelector: 'h1, h2, h3',
	};
	// let tocbot;
	onMount(async () => {
		await import('tocbot/dist/tocbot');

		window.tocbot.init(options);
	});
</script>

<style>
	/* The sidebar menu */
	aside {
		position: fixed;
		left: 10px;
		top: 25px;
		/* bottom: 0; */
		box-shadow: inset 5px 0 5px -5px #29627e;
		font-style: italic;
		color: #29627e;
		font-family: 'Fira Sans', sans-serif;
		background-color: grey;
	}
	article {
		margin-left: 160px; /* Same as the width of the sidebar */
		padding: 0px 10px;
	}

	/* On smaller screens, where height is less than 450px, change the style of the sidebar (less padding and a smaller font size) */
	@media screen and (max-height: 450px) {
		aside {
			padding-top: 15px;
		}
	}
</style>

<Menu>
	<aside id="toc" />
	<article id="content">
		{@html article.html}
	</article>
</Menu>
