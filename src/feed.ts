import type { WidgetApi } from '@edgestation/sdk';
import { absolute, parseFeed, type ParsedFeed, type Story } from './parse';

/** A feed that the widget follows. */
export interface Feed {
	/** The address of the feed itself, not of its site. */
	url: string;
	title: string;
}

/** A story with the address of its feed. */
export interface Item extends Story {
	feed: string;
}

/** The newest stories that the widget keeps from each feed. */
const PER_FEED = 50;

/**
 * Decodes `bytes` with the charset of the `Content-Type` header, else the encoding of the XML
 * declaration, else UTF-8. `Response.text()` allways uses UTF-8, and some old feeds are Latin-1.
 */
function decode(bytes: ArrayBuffer, type: string): string {
	const head = new TextDecoder('latin1').decode(bytes.slice(0, 200));
	const label =
		/charset=["']?([\w.:-]+)/i.exec(type)?.[1] ??
		/^<\?xml[^>]*encoding=["']([\w.:-]+)/i.exec(head)?.[1] ??
		'utf-8';
	try {
		return new TextDecoder(label).decode(bytes);
	} catch {
		return new TextDecoder().decode(bytes);
	}
}

async function download(api: WidgetApi, url: string): Promise<string> {
	const response = await api.fetch(url).catch(() => {
		throw new Error("Couldn't reach this site");
	});
	if (!response.ok) throw new Error(`The site answered ${response.status}`);
	return decode(await response.arrayBuffer(), response.headers.get('content-type') ?? '');
}

/** The list keys stories by id, so a story that a feed repeats shows once, as it first comes. */
function items(feed: string, parsed: ParsedFeed): Item[] {
	const unique = new Map<string, Story>();
	for (const story of parsed.stories) if (!unique.has(story.id)) unique.set(story.id, story);
	return [...unique.values()]
		.map((story) => ({ ...story, feed }))
		.sort((a, b) => b.date - a.date)
		.slice(0, PER_FEED);
}

/** The newest stories of `feed`, newest first. */
export async function load(api: WidgetApi, feed: Feed): Promise<Item[]> {
	const parsed = parseFeed(await download(api, feed.url), feed.url);
	if (!parsed) throw new Error('This address does not give a feed');
	return items(feed.url, parsed);
}

/** The feeds that a web page names in its head. */
function feedLinks(html: string, base: string): string[] {
	const doc = new DOMParser().parseFromString(html, 'text/html');
	const links = doc.querySelectorAll(
		'link[rel~="alternate" i][type*="rss+xml" i], link[rel~="alternate" i][type*="atom+xml" i]'
	);
	return [...links].flatMap((link) => absolute(link.getAttribute('href'), base) ?? []);
}

/**
 * Finds the feed at `typed`, the address of a feed or of a site. A site must name its feed in the
 * head of the page, as most blogs and news sites do. Also returns the stories, so that the feed
 * shows them at once.
 */
export async function find(api: WidgetApi, typed: string): Promise<{ feed: Feed; items: Item[] }> {
	const url = absolute(/^[a-z][\w+.-]*:/i.test(typed) ? typed : `https://${typed}`);
	if (!url || /\s/.test(typed)) throw new Error('This is not a web address');
	const page = await download(api, url);
	let found = { url, parsed: parseFeed(page, url) };
	if (!found.parsed) {
		const link = feedLinks(page, url)[0];
		if (!link) throw new Error('No feed found at this address');
		found = { url: link, parsed: parseFeed(await download(api, link), link) };
		if (!found.parsed) throw new Error('The feed of this site is not RSS or Atom');
	}
	const feed = { url: found.url, title: found.parsed.title || new URL(found.url).hostname };
	return { feed, items: items(feed.url, found.parsed) };
}
