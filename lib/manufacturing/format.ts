export function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	const units = ["KB", "MB", "GB"];
	let value = bytes / 1024;
	let unit = 0;
	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024;
		unit++;
	}
	return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

/** "4h", "2.5h" – trims trailing zeros. */
export function formatHours(hours: number): string {
	const rounded = Math.round(hours * 100) / 100;
	return `${rounded}h`;
}

/** "2d · 4h" or just "2d" when no effort is planned. */
export function formatEffort(
	days: number,
	hours: number | null | undefined,
): string {
	return hours == null ? `${days}d` : `${days}d · ${formatHours(hours)}`;
}
