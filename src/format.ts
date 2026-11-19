const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto', style: 'short' });
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
	['year', 365 * 86400],
	['month', 30 * 86400],
	['day', 86400],
	['hour', 3600],
	['minute', 60]
];

/** `date` relative to `now`, such as "2 hr. ago". Both are in milliseconds. */
export function ago(date: number, now: number): string {
	const seconds = Math.max(0, (now - date) / 1000);
	for (const [unit, size] of UNITS) {
		if (seconds >= size) return relative.format(-Math.floor(seconds / size), unit);
	}
	return relative.format(0, 'minute');
}

export const clock = new Intl.DateTimeFormat(undefined, { timeStyle: 'short' });
