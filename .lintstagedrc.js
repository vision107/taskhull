const prepareFiles = (filenames) =>
	filenames
		.filter((filename) => {
			const normalizedPath = filename.replace(/\\/g, "/");
			// Skip paths that oxfmt/oxlint ignore (see .oxfmtrc.json ignorePatterns),
			// otherwise oxfmt errors when every matched file is ignored.
			return (
				!normalizedPath.includes("lib/db/migrations/") &&
				!normalizedPath.includes(".cursor/")
			);
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
