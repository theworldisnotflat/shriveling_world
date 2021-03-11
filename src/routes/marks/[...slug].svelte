<script context="module">
	export async function preload({ params }) {
		const res = await this.fetch(`marks/${params.slug.join('/')}.json`);
		const article = await res.json();
		return { article };
	}
</script>

<script>
	import 'tocbot/dist/tocbot.css';
	import tocbot from 'tocbot';
	import Menu from '../../components/menu.svelte';
	import { onMount, afterUpdate } from 'svelte';
	export let article;
	let aside;
	const options = {
		tocSelector: '#toc',
		contentSelector: '#content',
		headingSelector: 'h1, h2, h3',
		onClick: (e) => console.log(e),
	};
	onMount(async () => {
		tocbot.init(options);
	});

	afterUpdate(async () => {
		tocbot.refresh();
	});
</script>

<Menu>
	<div style="height:100vh;">
		<aside id="toc" />
		<article id="content">
			{@html article.html}
		</article>
	</div>
</Menu>

<style>
	#content {
		position: relative;
		width: 80%;
		float: right;
		height: 100vh;
	}
	#toc {
		position: fixed;
		width: 20%;
		height: 100vh;
	}
</style>
