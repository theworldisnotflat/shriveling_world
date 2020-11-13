<script context="module" lang="ts">
	export async function preload() {
		const res = await this.fetch(`datasets/datasets.json`);
		const datasets = await res.json();

		return { datasets };
	}
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import Menu from '../../components/menu.svelte';
	import { inflate } from 'pako/lib/inflate';
	import type { IListFile } from '../../core/definitions/project';
	let bigBoard;
	let board: HTMLElement;
	let dat: HTMLElement;
	export let datasets;
	import { onDestroy } from 'svelte';

	async function addSet(event: MouseEvent) {
		const name = (event.target as HTMLElement).dataset.name;
		if (name !== undefined) {
			const zip = await fetch('datasets/' + name).then(async (raw) =>
				raw.arrayBuffer().then((buf) => new Uint8Array(buf))
			);
			const unzipped: IListFile[] = JSON.parse(new TextDecoder('utf-8').decode(inflate(zip)));
			bigBoard.cleanAll();
			void gui.filesToInsert(unzipped);
		}
	}
	onMount(async () => {
		const BigBoard = (await import('../../core/bigBoard/bigBoard')).default;
		bigBoard = new BigBoard(board, dat);
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
	.dataset {
		position: absolute;
		top: 50px;
		z-index: 3;
		color: wheat;
		text-shadow: 2px 2px 4px black;
		cursor: pointer;
	}
	.dat {
		top: 50px;
		z-index: 3;
		position: absolute;
		right: 0px;
	}
</style>

<Menu fixed={false}>
	<div bind:this={board} class="app" />
	<div class="dataset">
		{#each datasets as dataset, i}
			<div data-name={dataset}>{dataset}</div>
		{/each}
	</div>
	<div class="dat" bind:this={dat} />
</Menu>
