<script lang="ts">
	import { slide } from 'svelte/transition';
	export let fixed = true;
	let hover = true;
	function handleMove(event) {
		hover = fixed ? true : event.clientY < 80;
	}
</script>

<style>
	nav {
		width: 100%;
		margin: 0px auto 40px auto;
		background-color: darkgray;
		position: static;
		top: 0px;
		z-index: 10;
	}
	main {
		position: relative;
		z-index: 1;
	}

	nav ul {
		list-style-type: none;
	}

	nav li {
		float: left;
		width: 50%; /*100% divisé par le nombre d'éléments de menu*/
		text-align: center; /*Centre le texte dans les éléments de menu*/
	}

	/*Evite que le menu n'ait une hauteur nulle*/
	nav ul::after {
		content: '';
		display: table;
		clear: both;
	}

	nav a {
		display: block; /*Toute la surface sera cliquable*/
		text-decoration: none;
		color: black;
		border-bottom: 2px solid transparent; /*Evite le décalage des éléments sous le menu à cause de la bordure en :hover*/
		padding: 10px 0px; /*Agrandit le menu et espace la bordure du texte*/
	}

	nav a:hover {
		color: orange;
		border-bottom: 2px solid gold;
	}
</style>

{#if hover}
	<nav transition:slide={{ delay: 250, duration: 600 }}>
		<ul>
			<li><a href="app">application</a></li>
			<li><a href="doc">documentation développeurs</a></li>
		</ul>
	</nav>
{/if}
<main on:mousemove={handleMove}>
	<slot />
</main>
