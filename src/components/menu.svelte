<script lang="ts">
	import Icon from 'fa-svelte';
	import { faCaretDown } from '@fortawesome/free-solid-svg-icons/faCaretDown';
	import { slide } from 'svelte/transition';
	export let fixed = true;
	let hover = true;
	function handleMove(event) {
		hover = fixed ? true : event.clientY < 80;
	}
</script>

<style>
	nav {
		position: static;
	}
	main {
		position: relative;
		z-index: 1;
	}

	* {
		box-sizing: border-box;
	}

	.menu {
		display: flex;
		box-pack: center;
		justify-content: center;
		align-items: center;
		width: 95%;
		margin: 0 auto;
		font-family: 'Orbitron', sans-serif;
	}

	ul {
		display: flex;
		flex-wrap: wrap;
		box-align: center;
		align-items: center;
		box-pack: center;
		justify-content: center;
		width: 100%;
		margin: 0 auto;
		padding: 0.5em 0;
		list-style: none;
	}

	.menu-item {
		background: #444;
		padding: 1em 0.5em;
		position: relative;
		border-bottom: 5px solid #999;
		margin: 0 0.1em;
		transition: border-bottom 0.23s ease-in-out, background 0.23s linear;
		cursor: pointer;
		min-width: 8em;
		text-align: center;
	}
	.menu-item[aria-haspopup='true'] {
		border-bottom-color: #fc9b1b;
	}
	.menu-item:hover,
	.menu-item:focus-within {
		border-bottom-color: #91d36b;
		background: #333;
	}
	.menu-item:hover .sub-menu,
	.menu-item:hover .sub-menu:hover,
	.menu-item:focus-within .sub-menu,
	.menu-item:focus-within .sub-menu:hover {
		visibility: visible;
		opacity: 1;
		display: flex;
	}

	.sub-menu {
		flex-direction: column;
		align-items: flex-start;
		position: absolute;
		left: 0;
		margin-top: 1em;
		visibility: hidden;
		display: none;
		opacity: 0;
	}
	.sub-menu .menu-item {
		padding: 1em;
		width: 10em;
		text-align: center;
		z-index: 2;
	}

	a {
		color: #fff;
		text-decoration: none;
		text-transform: uppercase;
	}
	a:focus {
		outline: none;
	}

	@media (max-width: 690px) {
		.menu {
			width: 95%;
			font-size: 16px;
		}

		.menu-item {
			margin: 0.1em;
		}
		.menu-item:nth-child(1) {
			order: 0;
		}
		.menu-item:nth-child(2) {
			order: 1;
		}
		.menu-item:nth-child(3) {
			order: 3;
		}
		.menu-item:nth-child(4) {
			order: 4;
		}
		.menu-item:nth-child(5) {
			order: 2;
		}
	}
	@media (max-width: 480px) {
		.menu {
			font-size: 12px;
		}
	}
</style>

{#if hover}
	<nav class="menu" role="navigation" transition:slide={{ delay: 250, duration: 600 }}>
		<ul>
			<li class="menu-item" aria-haspopup="true">
				<a href="./">Shriveling the world
					<Icon icon={faCaretDown} /></a>
				<ul class="sub-menu" aria-label="submenu">
					<li class="menu-item"><a href="#0">Blog</a></li>
					<li class="menu-item"><a href="#0">github</a></li>
					<li class="menu-item"><a href="#0">other resources</a></li>
				</ul>
			</li>
			<li class="menu-item" aria-haspopup="true">
				<a href="app">application
					<Icon icon={faCaretDown} /></a>
				<ul class="sub-menu" aria-label="submenu">
					<li class="menu-item"><a href="#0">Help</a></li>
				</ul>
			</li>
			<li class="menu-item"><a href="doc">Dev Docs</a></li>
			<li class="menu-item" aria-haspopup="true">
				<a href="#0">User Doc
					<Icon icon={faCaretDown} /></a>
				<ul class="sub-menu" aria-label="submenu">
					<li class="menu-item"><a href="#0">Basic Usage tutorial</a></li>
					<li class="menu-item"><a href="#0">UI variables explanation</a></li>
					<li class="menu-item"><a href="#0">Datasets explanation</a></li>
					<li class="menu-item"><a href="#0">Blender tutorial</a></li>
				</ul>
			</li>
		</ul>
	</nav>
{/if}
<main on:mousemove={handleMove}>
	<slot />
</main>
