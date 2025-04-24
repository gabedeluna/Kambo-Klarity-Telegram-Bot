// eslint.config.js
const js = require("@eslint/js");
const globals = require("globals");
const pluginImport = require("eslint-plugin-import");
// eslint-config-prettier needs to be the last configuration in the array
// to override other configs. It's often applied directly.
const eslintConfigPrettier = require("eslint-config-prettier");

module.exports = [
  // Apply recommended rules globally
  js.configs.recommended,

  // Configuration for JS files (src, bin, etc.)
  {
    files: ["**/*.js"],
    plugins: {
      import: pluginImport,
    },
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "commonjs", // Explicitly set to commonjs
      globals: {
        ...globals.node, // Includes Node.js globals
      },
    },
    rules: {
      // Add any specific project rules here if needed
      // Example: 'no-unused-vars': 'warn'
    },
    settings: {
      // Settings for eslint-plugin-import if needed
      // 'import/resolver': { node: { extensions: ['.js'] } }
    },
  },

  // Configuration specifically for test files
  {
    files: ["src/tests/**/*.test.js"],
    languageOptions: {
      globals: {
        ...globals.mocha, // Includes Mocha globals like describe, it
      },
    },
    rules: {
      // Relax rules often needed in tests, e.g., console logs
      // 'no-console': 'off',
    },
  },

  // Apply Prettier overrides last
  eslintConfigPrettier,

  // Global ignores
  {
    ignores: [
      "node_modules/",
      "legacy/",
      "dist/",
      ".husky/",
      "coverage/", // Also ignore coverage reports
      ".nyc_output/", // And NYC output
    ],
  },
];
