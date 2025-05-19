// eslint.config.js
const js = require("@eslint/js");
const globals = require("globals");
const pluginImport = require("eslint-plugin-import");
const pluginJest = require("eslint-plugin-jest");
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
    files: ["tests/**/*.test.js", "tests/**/*.spec.js"],
    plugins: {
      jest: pluginJest,
    },
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
    rules: {
      // Relax rules often needed in tests
      'no-console': 'off',
      "no-unused-vars": [
        "error", 
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }
      ], // Allow unused vars/args prefixed with _
      "jest/no-disabled-tests": "warn",
      "jest/no-focused-tests": "error",
      "jest/no-identical-title": "error",
      "jest/prefer-to-have-length": "warn",
      "jest/valid-expect": "error"
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
