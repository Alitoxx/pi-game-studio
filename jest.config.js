module.exports = {
	testEnvironment: "node",
	testMatch: ["**/__tests__/**/*.[jt]s?(x)", "**/?(*.)+(spec|test).[tj]s?(x)"],
	testPathIgnorePatterns: ["/node_modules/", "/.pi/"],
	collectCoverageFrom: [
		"**/*.{js,ts}",
		"!**/node_modules/**",
		"!**/.pi/**",
		"!**/coverage/**",
	],
	coverageDirectory: "coverage",
	coverageReporters: ["text", "lcov", "html"],
};
