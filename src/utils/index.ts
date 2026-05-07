export function formatRelativeTime(isoDate: string): string {
	const diffMs = Date.now() - new Date(isoDate).getTime();
	const diffMin = Math.floor(diffMs / 60000);
	if (diffMin === 0) return "now";
	if (diffMin < 60)
		return diffMin === 1 ? `${diffMin} mins ago` : `${diffMin} min ago`;

	const diffHr = Math.floor(diffMin / 60);
	if (diffHr < 24)
		return diffHr === 1 ? `${diffHr} hour ago` : `${diffHr} hours ago`;

	const diffDay = Math.floor(diffHr / 24);
	if (diffDay < 7)
		return diffDay === 1 ? `${diffDay} day ago` : `${diffDay} days ago`;

	const diffWeek = Math.floor(diffDay / 7);
	if (diffWeek < 4)
		return diffWeek === 1 ? `${diffWeek} week ago` : `${diffWeek} weeks ago`;

	const diffMonth = Math.floor(diffDay / 30.44);
	if (diffMonth < 12)
		return diffMonth === 1
			? `${diffMonth} month ago`
			: `${diffMonth} months ago`;

	const diffYear = Math.floor(diffDay / 365.25);
	return diffYear === 1 ? `${diffYear} year ago` : `${diffYear} years ago`;
}
