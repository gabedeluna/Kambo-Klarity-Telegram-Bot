// eslint.config.js
const js = require("@eslint/js");
const globals = require("globals");
const pluginImport = require("eslint-plugin-import");
// eslint-config-prettier needs to be the last configuration in the array
// to override other configs. It's often applied directly.
const eslintConfigPrettier = require("eslint-config-prettier");

module.exports = [
  // Global ignores
  {
    ignores: [
      "public/pristine.min.js", // Ignore the minified library
      "node_modules/**",
      "dist/**",
      "coverage/**",
      ".next/**", // Ignore Next.js build directory
      "mem0/**", // Ignore mem0 external dependencies
    ],
  },
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
      "no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Add any other specific project rules here if needed
    },
    settings: {
      // Settings for eslint-plugin-import if needed
      // 'import/resolver': { node: { extensions: ['.js'] } }
    },
  },

  // Configuration specifically for test files
  {
    files: ["tests/**/*.js"], // Include all test files and setup files
    languageOptions: {
      globals: {
        ...globals.jest, // Includes Jest globals like describe, it, expect, jest
      },
    },
    rules: {
      // Relax rules often needed in tests, e.g., console logs
      // 'no-console': 'off',
      "no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ], // Allow unused vars/args prefixed with _
    },
  },

  // Configuration specifically for public/client-side files
  {
    files: ["public/**/*.js"],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "script", // Client-side scripts
      globals: {
        ...globals.browser, // Includes browser globals like window, document
        Telegram: "readonly", // Telegram WebApp API
      },
    },
    rules: {
      "no-unused-vars": [
        "warn", // Relax to warnings for client-side code
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-undef": "warn", // Relax to warnings for cross-file dependencies
    },
  },

  // Apply Prettier overrides last
  eslintConfigPrettier,
];
