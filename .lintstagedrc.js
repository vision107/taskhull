const prepareFiles = (filenames) =>
	filenames
		.filter((filename) => {
			const normalizedPath = filename.replace(/\\/g, "/");
			return !normalizedPath.includes("lib/db/migrations/");
		})
		.map((filename) => `'${filename.replace(/'/g, "'\\''")}'`)
		.join(" ");

module.exports = {
	"*.{js,jsx,ts,tsx,mjs,cjs}": (filenames) => {
		const files = prepareFiles(filenames);
		return files ? [`oxlint --fix ${files}`, `oxfmt ${files}`] : [];
	},
	"*.{json,jsonc,css,md,mdx}": (filenames) => {
		const files = prepareFiles(filenames);
		return files ? `oxfmt ${files}` : [];
	},
};
