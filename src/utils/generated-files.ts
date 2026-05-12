/**
 * Detects if a file is "generated" based on GitHub Linguist's heuristics.
 * Uses path-based patterns primarily, since we don't always have full file content.
 *
 * Mirrors GitHub's behavior of hiding these files from PR diffs by default.
 * Reference: https://github.com/github-linguist/linguist/blob/master/lib/linguist/generated.rb
 */
export function isGeneratedFile(filename: string): boolean {
	return (
		isGeneratedLockfile(filename) ||
		isGeneratedMinified(filename) ||
		isGeneratedSourceMap(filename) ||
		isGeneratedBuildArtifact(filename) ||
		isGeneratedProto(filename) ||
		isGeneratedDependency(filename) ||
		isGeneratedToolOutput(filename) ||
		isGeneratedVendorDir(filename)
	);
}

// Lock files
function isGeneratedLockfile(filename: string): boolean {
	const lockfilePatterns = [
		/^package-lock\.json$/,
		/^yarn\.lock$/,
		/^pnpm-lock\.yaml$/,
		/^Cargo\.lock$/,
		/^Gemfile\.lock$/,
		/^poetry\.lock$/,
		/^composer\.lock$/,
		/^Pipfile\.lock$/,
		/^pdm\.lock$/,
		/^uv\.lock$/,
		/^pixi\.lock$/,
		/^deno\.lock$/,
		/^go\.sum$/,
		/(?:^|\/)flake\.lock$/,
		/(?:^|\/)MODULE\.bazel\.lock$/,
		/(?:^|\/)\.terraform\.lock\.hcl$/,
		/(?:^|\/)mise(?:\.[^\/]+)?\.lock$/,
		/(?:^|\/)\w+\.esy\.lock$/,
		/(?:^|\/)bun\.lockb?$/,
		/(?:^|\/)\.pnp\..*$/,
		/(Gopkg|glide)\.lock/,
		/Package\.resolved/,
		/npm-shrinkwrap\.json/,
	];
	return lockfilePatterns.some((p) => p.test(filename));
}

// Minified JS/CSS — average line length > 110 is the real heuristic,
// but we can detect common minified naming patterns
function isGeneratedMinified(filename: string): boolean {
	return /\.min\.(js|css)$/i.test(filename);
}

// Source maps
function isGeneratedSourceMap(filename: string): boolean {
	if (/\.map$/.test(filename)) return true;
	return /(\.css|\.js)\.map$/i.test(filename);
}

// Build artifacts
function isGeneratedBuildArtifact(filename: string): boolean {
	return [
		/\.nib$/,
		/\.xcworkspacedata$/,
		/\.xcuserstate$/,
		/\.designer\.(cs|vb)$/i,
		/\.feature\.cs$/i,
		/\.g\.dart$/,
		/_tlb\.pas$/i,
		/\.(pyc|pyo)$/,
		/\.class$/,
		/\.o$/,
		/\.obj$/,
		/\.lib$/,
		/\.dll$/,
		/\.so$/,
		/\.dylib$/,
		/\.exe$/,
		/\.ilk$/,
		/\.pdb$/,
		/\.pch$/,
	].some((p) => p.test(filename));
}

// Protocol Buffer generated files
function isGeneratedProto(filename: string): boolean {
	return /\.pb\.(go|swift|java|py|h|cc|cpp|m|rb|php)$/i.test(filename);
}

// Dependency directories and vendor files
function isGeneratedDependency(filename: string): boolean {
	return [
		/node_modules\//,
		/(^Pods|\/Pods)\//,
		/(^|\/)Carthage\/Build\//,
		/Godeps\//,
		/(?:^|\/)htmlcov\//,
		/__generated__\//,
	].some((p) => p.test(filename));
}

// Tool-specific generated output
function isGeneratedToolOutput(filename: string): boolean {
	return [
		/(?:^|\/)gradlew(?:\.bat)?$/i,
		/(?:^|\/)mvnw(?:\.cmd)?$/i,
		/\.zep\.(?:c|h|php)$/,
		/Cargo\.toml\.orig/,
		/ppport\.h$/,
		/\.yy$/,
		/\.yyp$/,
		/\.meta$/,
		/\.g$/,
		/(?:^|\/)\.sqlx\/query-[a-f\d]{64}\.json$/,
	].some((p) => p.test(filename));
}

// Vendor directories (non-human code )
function isGeneratedVendorDir(filename: string): boolean {
	return [
		/(?:^|\/)\.idea\//,
		/vendor\/((?!-)[-0-9A-Za-z]+(?<!-)\.)+(com|edu|gov|in|me|net|org|fm|io)/,
	].some((p) => p.test(filename));
}
