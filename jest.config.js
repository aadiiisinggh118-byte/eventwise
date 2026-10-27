const nextJest = require("next/jest");
const createJestConfig = nextJest({ dir: "./" });

/** @type {import('jest').Config} */
module.exports = createJestConfig({
  // Pure logic and API routes run in node; component tests opt into jsdom
  // with a `@jest-environment jsdom` docblock.
  testEnvironment: "node",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  testPathIgnorePatterns: ["<rootDir>/node_modules/", "<rootDir>/.next/"],
  coverageProvider: "v8",
  collectCoverageFrom: ["lib/**/*.js", "ai/**/*.js", "components/**/*.jsx", "app/**/*.{js,jsx}"],
});
