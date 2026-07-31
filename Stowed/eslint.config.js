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

  // CommonJS build/tooling config (eslint.config.js, rspack.config.js).
  {
    files: ["*.config.js", "*.config.cjs"],
    languageOptions: {
      sourceType: "commonjs",
      globals: { ...globals.node },
    },
  },

  // ESM config files (postcss.config.mjs).
  {
    files: ["*.config.mjs", "*.mjs"],
    languageOptions: {
      sourceType: "module",
      globals: { ...globals.node },
    },
  },

  // Turn off rules that conflict with Prettier formatting.
  prettier,

  // Project rule policy (applied last so these severities win).
  {
    rules: {
      // JS-only project with no PropTypes/TypeScript — prop validation not enforced.
      "react/prop-types": "off",

      // React Compiler rules that flag intentional or hard-to-refactor patterns
      // (ref-based undo/redo in EditorContext, Konva group-ref registry, and the
      // many "seed/reset local state from async data" effects across pages).
      // Kept visible as warnings for incremental cleanup rather than blocking;
      // fixing them cleanly requires behavioral refactors of forms/canvas/selectors.
      // rules-of-hooks and exhaustive-deps stay at their defaults.
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/set-state-in-render": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
];
