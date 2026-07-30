const js = require("@eslint/js");
const react = require("eslint-plugin-react");
const reactHooks = require("eslint-plugin-react-hooks");
const globals = require("globals");
const prettier = require("eslint-config-prettier");

// Globals injected by Meteor's build. Most code imports these explicitly from
// "meteor/*", but declaring them here keeps no-undef quiet where they're used bare.
const meteorGlobals = {
  Meteor: "readonly",
  Mongo: "readonly",
  Tracker: "readonly",
  Session: "readonly",
  Accounts: "readonly",
  ReactiveVar: "readonly",
  ReactiveDict: "readonly",
  WebApp: "readonly",
  DDP: "readonly",
  DDPRateLimiter: "readonly",
  EJSON: "readonly",
  Random: "readonly",
  check: "readonly",
  Match: "readonly",
};

module.exports = [
  // Ignore build output and static assets (mirrors .gitignore).
  {
    ignores: [
      "node_modules/",
      ".meteor/local/",
      "_build/",
      "**/build-assets/**",
      "**/build-chunks/**",
      ".rsdoctor/",
      "public/",
      "private/",
    ],
  },

  // Base config: which files to lint + shared language options and Meteor globals.
  {
    files: ["**/*.{js,mjs,cjs,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...meteorGlobals },
    },
    settings: { react: { version: "detect" } },
  },

  // Recommended rule sets (applied as errors).
  js.configs.recommended,
  react.configs.flat.recommended,
  react.configs.flat["jsx-runtime"], // React 18 automatic runtime: no React import needed
  reactHooks.configs.flat.recommended,

  // Client-side code runs in the browser.
  {
    files: ["client/**", "imports/ui/**"],
    languageOptions: { globals: { ...globals.browser } },
  },

  // Server-side code and the data layer run in Node.
  {
    files: ["server/**", "imports/api/**"],
    languageOptions: { globals: { ...globals.node } },
  },

  // Mocha test files.
  {
    files: ["tests/**", "**/*.test.js"],
    languageOptions: { globals: { ...globals.node, ...globals.mocha } },
  },

  // Build/tooling config files run in Node.
  {
    files: ["*.config.js", "*.config.mjs", "rspack.config.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: { ...globals.node },
    },
  },

  // Must be last: turn off rules that conflict with Prettier formatting.
  prettier,
];
