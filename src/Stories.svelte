<script lang="ts">
	import type { WidgetApi } from '@edgestation/sdk';
	import { SvelteSet } from 'svelte/reactivity';
	import type { Feed, Item } from './feed';
	import { ago, clock } from './format';

	let {
		api,
		feeds,
		filter,
		items,
		failed,
		titles,
		now,
		loadedAt,
		refreshing,
		onfilter,
		onopen,
		onadd,
		onremove,
		onrefresh
	}: {
		api: WidgetApi;
		feeds: Feed[];
		/** The address of the feed that the list shows, or `null` for all feeds. */
		filter: string | null;
		items: Item[];
		/** True if the feed of `filter` did not load. */
		failed: boolean;
		/** The title of each feed by address. */
		titles: Map<string, string>;
		now: number;
		/** When the last load started, in milliseconds. */
		loadedAt: number;
		refreshing: boolean;
		onfilter: (url: string | null) => void;
		onopen: (item: Item) => void;
		onadd: () => void;
		onremove: (url: string) => void;
		onrefresh: () => void;
	} = $props();

	/** The pictures that did not load. Their rows show text only. */
	const broken = new SvelteSet<string>();
</script>

<header class="bar">
	<div class="chips">
		<button class="pill" class:on={filter === null} onclick={() => onfilter(null)}>All</button>
		{#each feeds as feed (feed.url)}
			<button class="pill" class:on={filter === feed.url} onclick={() => onfilter(feed.url)}>
				{feed.title}
			</button>
		{/each}
		<button class="icon" aria-label="Add a feed" title="Add a feed" onclick={onadd}>
			<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
		</button>
	</div>
	{#if filter !== null}
		<button class="pill" onclick={() => onremove(filter!)}>Remove feed</button>
	{/if}
	<!-- A clock time stays true with no timer. "5 min ago" would need one to keep up. -->
	<span class="status">{refreshing ? 'Refreshing…' : clock.format(loadedAt)}</span>
	<button
		class="icon"
		aria-label="Refresh"
		title="Refresh"
		disabled={refreshing}
		onclick={onrefresh}
	>
		<svg class:spin={refreshing} viewBox="0 0 24 24" aria-hidden="true">
			<!-- Lucide "refresh-cw" icon, ISC license: https://lucide.dev/license -->
			<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
			<path d="M21 3v5h-5" />
			<path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
			<path d="M8 16H3v5" />
		</svg>
	</button>
</header>

{#if items.length}
	<!-- This holds the overlay scrollbars of the list. -->
	<div class="list">
		<ul class="rows" {@attach (ul) => api.scrollbars(ul)}>
			{#each items as item (`${item.feed}\n${item.id}`)}
				<li>
					<button class="row" disabled={!item.link} onclick={() => onopen(item)}>
						<span class="text">
							<span class="meta">
								{titles.get(item.feed)}{#if item.date}&ensp;·&ensp;{ago(item.date, now)}{/if}
							</span>
							<span class="title">{item.title || 'Untitled'}</span>
						</span>
						{#if item.image && !broken.has(item.image)}
							<img
								class="thumb"
								src={item.image}
								alt=""
								loading="lazy"
								referrerpolicy="no-referrer"
								onerror={() => broken.add(item.image!)}
							/>
						{/if}
					</button>
				</li>
			{/each}
		</ul>
	</div>
{:else}
	<p class="note">
		{failed
			? "Couldn't load this feed. Its site may be down."
			: refreshing
				? ''
				: 'No stories yet.'}
	</p>
{/if}

<style>
	.chips {
		display: flex;
		flex: 1;
		align-items: center;
		gap: 0.4em;
		min-width: 0;
		overflow-x: auto;
		scrollbar-width: none;
		overscroll-behavior: contain;
	}

	.chips .pill {
		max-width: 14em;
		overflow: hidden;
		text-overflow: ellipsis;
		font-size: 0.85em;
	}

	.chips .pill.on {
		background: var(--primary);
		color: var(--primary-foreground);
	}

	.status {
		flex: none;
		color: var(--muted-foreground);
		font-size: 0.8em;
		font-variant-numeric: tabular-nums;
	}

	.icon:disabled {
		cursor: default;
	}

	.spin {
		color: var(--primary);
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			rotate: 360deg;
		}
	}

	/* It holds the overlay scrollbars of `.rows`. */
	.list {
		flex: 1;
		min-height: 0;
	}

	/* Rows go in colums of at least 22em, so a wide cell shows more stories at once. */
	.rows {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(22em, 100%), 1fr));
		grid-auto-rows: 4.4em;
		gap: 0.5em;
		height: 100%;
		margin: 0;
		padding: 0;
		overscroll-behavior: contain;
		list-style: none;
	}

	.row {
		display: flex;
		align-items: stretch;
		gap: 0.7em;
		width: 100%;
		height: 100%;
		padding: 0.45em 0.45em 0.45em 0.7em;
		border-radius: var(--radius);
		background: color-mix(in oklch, var(--card-foreground) 6%, transparent);
		text-align: left;
		transition: scale 120ms;
	}

	.row:active:not(:disabled) {
		scale: 0.98;
	}

	.row:disabled {
		cursor: default;
	}

	.meta {
		overflow: hidden;
		color: var(--muted-foreground);
		font-size: 0.75em;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.text {
		display: flex;
		flex: 1;
		flex-direction: column;
		justify-content: center;
		gap: 0.15em;
		min-width: 0;
	}

	.title {
		display: -webkit-box;
		overflow: hidden;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		font-size: 0.9em;
		font-weight: 600;
		line-height: 1.25;
	}

	.thumb {
		flex: none;
		aspect-ratio: 16 / 10;
		height: 100%;
		border-radius: calc(var(--radius) * 0.6);
		object-fit: cover;
	}
</style>
