<script lang="ts">
	import type { WidgetApi } from '@edgestation/sdk';
	import AddFeed from './AddFeed.svelte';
	import { load, type Feed, type Item } from './feed';
	import Stories from './Stories.svelte';

	let props: { api: WidgetApi } = $props();
	// `api` does not change. A changed setting mounts the widget again.
	// svelte-ignore state_referenced_locally
	const { api } = props;

	/** The time between two loads while the page shows. */
	const RELOAD = 15 * 60_000;
	/** The most stories that the list shows, for a fast list. */
	const MAX = 200;

	/** `undefined` until the widget reads the saved feeds. */
	let feeds = $state.raw<Feed[]>();
	/** The stories of each feed by address, newest first. `null` if its first load failed. */
	let stories = $state.raw<Record<string, Item[] | null>>({});
	/** The address of the feed that the list shows, or `null` for all feeds. */
	let filter = $state.raw<string | null>(null);
	let adding = $state(false);
	let now = $state(Date.now());
	/** When the last load started, in milliseconds. */
	let loadedAt = $state(0);
	let refreshing = $state(false);

	const titles = $derived(new Map(feeds?.map((feed) => [feed.url, feed.title])));
	const shown = $derived(
		(filter ? [stories[filter] ?? []] : Object.values(stories).map((list) => list ?? []))
			.flat()
			.sort((a, b) => b.date - a.date)
			.slice(0, MAX)
	);

	/** Loads the stories of `list`. A feed that fails keeps the stories it had. */
	async function loadFeeds(list: Feed[]) {
		const loaded = await Promise.all(
			list.map(async (feed) => [feed.url, await load(api, feed).catch(() => null)] as const)
		);
		const next = { ...stories };
		for (const [url, found] of loaded) {
			// The user can remove a feed while it loads.
			if (feeds?.some((feed) => feed.url === url)) next[url] = found ?? next[url] ?? null;
		}
		stories = next;
	}

	async function reload() {
		loadedAt = now = Date.now();
		await loadFeeds(feeds ?? []);
	}

	/** The Refresh button. The card shows its loading bar too. */
	async function refresh() {
		refreshing = true;
		try {
			await api.loading(reload());
		} finally {
			refreshing = false;
		}
	}

	api.guard(() =>
		api.loading(
			(async () => {
				feeds = (await api.storage.instance.get<Feed[]>('feeds')) ?? [];
				await reload();
			})()
		)
	)();

	// `every` also ticks each time the page shows again. The time check keeps loads 15 min apart.
	api.every(RELOAD, () => {
		now = Date.now();
		if (feeds && now - loadedAt >= RELOAD) void reload();
	});

	const save = api.guard(async (next: Feed[]) => {
		feeds = next;
		await api.storage.instance.set('feeds', next);
	});

	function add(feed: Feed, items: Item[]) {
		adding = false;
		if (feeds!.some((known) => known.url === feed.url)) return;
		stories = { ...stories, [feed.url]: items };
		save([...feeds!, feed]);
	}

	function remove(url: string) {
		const { [url]: _, ...rest } = stories;
		stories = rest;
		filter = null;
		save(feeds!.filter((feed) => feed.url !== url));
	}

	/** The page of a story opens in the default browser. A failure leaves the list as it is. */
	function open(item: Item) {
		if (item.link) api.openUrl(item.link).catch(console.error);
	}
</script>

<!-- `el` is the size container, so its padding cannot use cqh or cqw. Put the layout in it. -->
<div class="rss">
	{#if feeds && (adding || feeds.length === 0)}
		<AddFeed
			{api}
			followed={feeds.map((feed) => feed.url)}
			onadd={add}
			onback={feeds.length ? () => (adding = false) : undefined}
		/>
	{:else if feeds}
		<Stories
			{api}
			{feeds}
			{filter}
			items={shown}
			failed={filter !== null && stories[filter] === null}
			{titles}
			{now}
			{loadedAt}
			{refreshing}
			onfilter={(url) => (filter = url)}
			onopen={open}
			onadd={() => (adding = true)}
			onremove={remove}
			onrefresh={refresh}
		/>
	{/if}
</div>

<style>
	/* The font follows the height of the cell, and the width of a narrow one, with limits that
	   keep the text readable. */
	.rss {
		display: flex;
		flex-direction: column;
		gap: 0.6em;
		height: 100%;
		padding: 0.75em;
		font-size: clamp(12px, min(4.5cqh, 2.2cqw), 20px);
	}

	/* The rest is shared with the other components. */
	:where(.rss) :global(button) {
		padding: 0;
		border: none;
		background: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	:where(.rss) :global(.pill) {
		flex: none;
		padding: 0.4em 1em;
		border-radius: 999px;
		background: color-mix(in oklch, var(--card-foreground) 10%, transparent);
		white-space: nowrap;
	}

	:where(.rss) :global(.pill.primary) {
		background: var(--primary);
		color: var(--primary-foreground);
	}

	:where(.rss) :global(.pill:disabled) {
		opacity: 0.5;
		cursor: default;
	}

	:where(.rss) :global(.bar) {
		display: flex;
		flex: none;
		align-items: center;
		gap: 0.6em;
		min-height: 2.2em;
	}

	:where(.rss) :global(.icon) {
		display: grid;
		flex: none;
		place-items: center;
		width: 2.2em;
		height: 2.2em;
		border-radius: 50%;
	}

	:where(.rss) :global(.icon:active) {
		background: color-mix(in oklch, var(--card-foreground) 10%, transparent);
	}

	:where(.rss) :global(.icon svg) {
		width: 1.2em;
		fill: none;
		stroke: currentColor;
		stroke-width: 2.5;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	:where(.rss) :global(.note) {
		margin: auto;
		color: var(--muted-foreground);
		text-align: center;
	}
</style>
