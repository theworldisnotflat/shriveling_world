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

	nav {
		text-align: center;
		font-size: 16px;
	}
	nav ul li {
		list-style: none;
		margin: 0 auto;
		border-left: 2px solid #3ca0e7;
		display: inline-block;
		padding: 0 30px;
		position: relative;
		text-decoration: none;
		text-align: center;
		font-family: arvo;
		z-index: 5;
	}
	nav li a {
		color: black;
	}
	nav li a:hover {
		color: #3ca0e7;
	}
	nav li:hover {
		cursor: pointer;
	}
	nav ul li ul {
		visibility: hidden;
		opacity: 0;
		position: absolute;
		padding-left: 0;
		left: 0;
		display: none;
		background: white;
		z-index: 5;
	}
	nav ul li:hover > ul,
	nav ul li ul:hover {
		visibility: visible;
		opacity: 1;
		display: block;
		min-width: 250px;
		text-align: left;
		padding-top: 20px;
		box-shadow: 0px 3px 5px -1px #ccc;
	}
	nav ul li ul li {
		clear: both;
		width: 100%;
		text-align: left;
		margin-bottom: 20px;
		border-style: none;
	}
	nav ul li ul li a:hover {
		padding-left: 10px;
		border-left: 2px solid #3ca0e7;
		transition: all 0.3s ease;
	}

	a {
		text-decoration: none;
	}
	a:hover {
		color: #3ca0e7;
	}

	ul li ul li a {
		transition: all 0.5s ease;
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
					<li class="menu-item"><a href="marks/create_dataset">Dataset creation</a></li>
					<li class="menu-item"><a href="#0">Blender tutorial</a></li>
				</ul>
			</li>
		</ul>
	</nav>
{/if}
<main on:mousemove={handleMove}>
	<slot />
</main>
