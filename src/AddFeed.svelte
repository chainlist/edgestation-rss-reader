<script lang="ts">
	import type { WidgetApi } from '@edgestation/sdk';
	import { find, type Feed, type Item } from './feed';

	let {
		api,
		followed,
		onadd,
		onback
	}: {
		api: WidgetApi;
		/** The addresses of the feeds that the widget follows. */
		followed: string[];
		onadd: (feed: Feed, items: Item[]) => void;
		/** `undefined` while the widget has no feed, because there is nothing to go back to. */
		onback?: () => void;
	} = $props();

	const SUGGESTED = [
		{ name: 'BBC News', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
		{ name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml' },
		{ name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index' },
		{ name: 'Hacker News', url: 'https://news.ycombinator.com/rss' },
		{ name: 'PC Gamer', url: 'https://www.pcgamer.com/rss/' },
		{ name: 'Polygon', url: 'https://www.polygon.com/rss/index.xml' }
	];

	let typed = $state('');
	/** The address that loads, typed or suggested. */
	let busy = $state<string>();
	let error = $state('');

	async function add(address: string) {
		if (busy) return;
		busy = address;
		error = '';
		try {
			const { feed, items } = await api.loading(find(api, address));
			onadd(feed, items);
		} catch (failure) {
			error = failure instanceof Error ? failure.message : String(failure);
		} finally {
			busy = undefined;
		}
	}

	function onsubmit(event: SubmitEvent) {
		event.preventDefault();
		if (typed.trim()) void add(typed.trim());
	}
</script>

<div class="add">
	<form class="bar" {onsubmit}>
		{#if onback}
			<button type="button" class="icon" aria-label="Back" title="Back" onclick={onback}>
				<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
			</button>
		{/if}
		<input
			bind:value={typed}
			placeholder="Address of a feed or a site"
			aria-label="Address of a feed or a site"
			inputmode="url"
			enterkeyhint="go"
			autocomplete="off"
			spellcheck="false"
			oninput={() => (error = '')}
			onkeydown={(event) => event.key === 'Escape' && onback?.()}
		/>
		<button class="pill primary" disabled={!typed.trim() || !!busy}>
			{busy === typed.trim() ? 'Adding…' : 'Add'}
		</button>
	</form>

	<p class="hint" class:error>
		{error || 'Paste the address of a news site or blog, or pick a feed below.'}
	</p>

	<ul class="suggested">
		{#each SUGGESTED as { name, url } (url)}
			{@const added = followed.includes(url)}
			<li>
				<button class="pill" disabled={added || !!busy} onclick={() => add(url)}>
					{busy === url ? 'Adding…' : added ? `${name} ✓` : name}
				</button>
			</li>
		{/each}
	</ul>
</div>

<style>
	.add {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 0.6em;
		min-height: 0;
	}

	input {
		flex: 1;
		min-width: 0;
		height: 2.2em;
		padding: 0 0.7em;
		border: 1px solid var(--border);
		border-radius: calc(var(--radius) * 0.75);
		background: transparent;
		color: inherit;
		font: inherit;
	}

	input::placeholder {
		color: var(--muted-foreground);
	}

	input:focus {
		border-color: var(--ring);
		outline: none;
	}

	.hint {
		margin: 0;
		color: var(--muted-foreground);
		font-size: 0.85em;
	}

	.hint.error {
		color: var(--destructive);
	}

	.suggested {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5em;
		margin: 0;
		padding: 0;
		list-style: none;
	}
</style>
