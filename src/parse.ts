/** A story, as the feed gives it. */
export interface Story {
	/** Unique in its feed. */
	id: string;
	title: string;
	/** The web page of the story. */
	link?: string;
	/** Unix time in milliseconds. 0 if the feed gives no date. */
	date: number;
	/** A picture of the story. */
	image?: string;
}

export interface ParsedFeed {
	title: string;
	stories: Story[];
}

const ATOM = 'http://www.w3.org/2005/Atom';
const RSS1 = 'http://purl.org/rss/1.0/';
const CONTENT = 'http://purl.org/rss/1.0/modules/content/';
const DC = 'http://purl.org/dc/elements/1.1/';
const MEDIA = 'http://search.yahoo.com/mrss/';
const ITUNES = 'http://www.itunes.com/dtds/podcast-1.0.dtd';

/** RSS 2.0 elements have no namespace. */
type Ns = string | null;

const child = (el: Element | undefined, name: string, ns: Ns) =>
	el && [...el.children].find((c) => c.localName === name && c.namespaceURI === ns);

const text = (el: Element | undefined) => el?.textContent?.trim() ?? '';

/** `url` made absolute from `base`, or `undefined` if it is not a web address. */
export function absolute(url: string | null | undefined, base?: string): string | undefined {
	if (!url) return undefined;
	try {
		const found = new URL(url.trim(), base);
		return found.protocol === 'http:' || found.protocol === 'https:' ? found.href : undefined;
	} catch {
		return undefined;
	}
}

/** Titles can hold entities or tags, sometimes escaped twice. The parser does not run scripts. */
function plain(value: string): string {
	if (!/[<&]/.test(value)) return value;
	const doc = new DOMParser().parseFromString(value, 'text/html');
	return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function date(value: string): number {
	const time = Date.parse(value);
	return Number.isNaN(time) ? 0 : time;
}

/** The first picture in `html`. */
function firstImage(html: string): string | undefined {
	return /<img\b[^>]*?\ssrc\s*=\s*["']([^"']+)["']/i.exec(html)?.[1];
}

/** The picture of the Media RSS extention, also inside `media:group`. */
function mediaImage(item: Element): string | undefined {
	const thumbnail = item.getElementsByTagNameNS(MEDIA, 'thumbnail')[0];
	if (thumbnail) return thumbnail.getAttribute('url') ?? undefined;
	const content = [...item.getElementsByTagNameNS(MEDIA, 'content')].find(
		(el) => el.getAttribute('medium') === 'image' || el.getAttribute('type')?.startsWith('image/')
	);
	return content?.getAttribute('url') ?? undefined;
}

/** RSS 2.0, or RSS 1.0 with `ns`. */
function rssStory(item: Element, ns: Ns, base: string): Story {
	const link = absolute(text(child(item, 'link', ns)), base);
	const guid = child(item, 'guid', ns);
	const content = text(child(item, 'encoded', CONTENT)) || text(child(item, 'description', ns));
	const enclosure = child(item, 'enclosure', ns);
	const picture =
		mediaImage(item) ??
		(enclosure?.getAttribute('type')?.startsWith('image/')
			? enclosure.getAttribute('url')
			: undefined) ??
		child(item, 'image', ITUNES)?.getAttribute('href') ??
		firstImage(content);
	const title = plain(text(child(item, 'title', ns)));
	const when = date(text(child(item, 'pubDate', ns)) || text(child(item, 'date', DC)));
	return {
		id: text(guid) || item.getAttribute('rdf:about') || link || `${title}@${when}`,
		title,
		link:
			link ??
			(guid?.getAttribute('isPermaLink') !== 'false' ? absolute(text(guid), base) : undefined),
		date: when,
		image: absolute(picture, link ?? base)
	};
}

/** The HTML of an Atom text element. `xhtml` holds a `div` of elements, the others hold text. */
function atomHtml(el: Element | undefined): string {
	if (!el) return '';
	if (el.getAttribute('type') === 'xhtml') return el.firstElementChild?.innerHTML ?? '';
	return text(el);
}

function atomStory(entry: Element, base: string): Story {
	const links = [...entry.children].filter(
		(c) => c.localName === 'link' && c.namespaceURI === ATOM
	);
	const page = links.find((l) => (l.getAttribute('rel') ?? 'alternate') === 'alternate');
	const enclosure = links.find(
		(l) => l.getAttribute('rel') === 'enclosure' && l.getAttribute('type')?.startsWith('image/')
	);
	const link = absolute(page?.getAttribute('href'), base);
	const content =
		atomHtml(child(entry, 'content', ATOM)) || atomHtml(child(entry, 'summary', ATOM));
	const title = plain(atomHtml(child(entry, 'title', ATOM)));
	const when = date(text(child(entry, 'published', ATOM)) || text(child(entry, 'updated', ATOM)));
	return {
		id: text(child(entry, 'id', ATOM)) || link || `${title}@${when}`,
		title,
		link,
		date: when,
		image: absolute(
			mediaImage(entry) ?? enclosure?.getAttribute('href') ?? firstImage(content),
			link ?? base
		)
	};
}

/**
 * Reads an RSS 2.0, RSS 1.0 or Atom feed. `base` is the address of the feed, for relative
 * links. Returns `null` if `xml` is not a feed, for example a web page.
 */
export function parseFeed(xml: string, base: string): ParsedFeed | null {
	const doc = new DOMParser().parseFromString(xml, 'application/xml');
	if (doc.getElementsByTagName('parsererror').length) return null;
	const root = doc.documentElement;
	if (root.localName === 'feed' && root.namespaceURI === ATOM) {
		const entries = [...root.children].filter(
			(c) => c.localName === 'entry' && c.namespaceURI === ATOM
		);
		return {
			title: plain(atomHtml(child(root, 'title', ATOM))),
			stories: entries.map((entry) => atomStory(entry, base))
		};
	}
	// RSS 1.0 puts its items next to the channel, RSS 2.0 puts them inside it.
	const ns = root.localName === 'RDF' ? RSS1 : root.localName === 'rss' ? null : undefined;
	if (ns === undefined) return null;
	const channel = child(root, 'channel', ns);
	if (!channel) return null;
	const items = [...(ns ? root : channel).children].filter(
		(c) => c.localName === 'item' && c.namespaceURI === ns
	);
	return {
		title: plain(text(child(channel, 'title', ns))),
		stories: items.map((item) => rssStory(item, ns, base))
	};
}
