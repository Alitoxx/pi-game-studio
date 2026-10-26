// Coverage is scoped to scripts/ on purpose, and the reason is structural: the
// extension's suites execute TypeScript inside child node processes, so those
// modules never load in the jest VM and any `extensions/**` entry here would
// report a flat 0% that says nothing. The extension is guarded behaviourally
// instead — registration surface, command surface, model config, cross
// references — and `tsc --noEmit` covers its types. Adding a fake floor here
// would only make the report look complete.
module.exports = {
	testEnvironment: "node",
	testMatch: ["**/__tests__/**/*.[jt]s?(x)", "**/?(*.)+(spec|test).[tj]s?(x)"],
	testPathIgnorePatterns: ["/node_modules/", "/.pi/"],
	collectCoverageFrom: [
		"scripts/**/*.js",
		"!**/node_modules/**",
		"!**/.pi/**",
		"!**/coverage/**",
	],
	coverageDirectory: "coverage",
	coverageReporters: ["text", "lcov", "html"],
};
