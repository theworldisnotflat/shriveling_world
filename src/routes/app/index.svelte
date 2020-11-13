<script lang="ts">
	import { onMount } from 'svelte';
	import Menu from '../../components/menu.svelte';
	let bigBoard;
	let board: HTMLElement;

	import { onDestroy } from 'svelte';

	onDestroy(() => {
		console.log('the component is being destroyed');
	});

	onMount(async () => {
		const BigBoard = (await import('../../core/bigBoard/bigBoard')).default;
		bigBoard = new BigBoard(board);
	});
</script>

<style>
	.app {
		background: #000;
		color: #fff;
		padding: 0;
		margin: 0;
		font-weight: bold;
		overflow: hidden;
	}
</style>

<Menu fixed={false}>
	<div bind:this={board} class="app" />
</Menu>
