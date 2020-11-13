<script>
	import successkid from 'images/successkid.jpg';
	import Menu from '../components/menu.svelte';
</script>

<style>
	h1,
	figure,
	p {
		text-align: center;
		margin: 0 auto;
	}

	h1 {
		font-size: 2.8em;
		text-transform: uppercase;
		font-weight: 700;
		margin: 0 0 0.5em 0;
	}

	figure {
		margin: 0 0 1em 0;
	}

	img {
		width: 100%;
		max-width: 400px;
		margin: 0 0 1em 0;
	}

	p {
		margin: 1em auto;
	}

	@media (min-width: 480px) {
		h1 {
			font-size: 4em;
		}
	}
</style>

<Menu fixed={false}>
	<h1>Great success!</h1>

	<figure><img alt="Success Kid" src={successkid} /></figure>
</Menu>
<svelte:head>
	<title>Sapper project template</title>
</svelte:head>
