import globals from 'globals';

const shared = {
  linterOptions: { reportUnusedDisableDirectives: 'error' },
  rules: {
    'no-var': 'error',
    'prefer-const': 'error',
    eqeqeq: ['error', 'smart'],
    'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
    'no-undef': 'error',
    'no-implicit-globals': 'error',
    'no-throw-literal': 'error',
    'no-constant-binary-expression': 'error',
    'no-self-compare': 'error',
    'no-unmodified-loop-condition': 'error',
    'no-unused-private-class-members': 'error',
    'no-template-curly-in-string': 'warn',
  },
};

export default [
  { ignores: ['node_modules/', 'tests/*-fixtures.js'] },
  // Browser bundle: plain scripts sharing one global scope, loaded in <script> order.
  {
    files: [
      'world.js',
      'engine.js',
      'art.js',
      'audio.js',
      'ui-store.js',
      'ui-effects.js',
      'ui-map.js',
      'ui-board.js',
      'ui-battle.js',
      'ui-dialogs.js',
      'game.js',
    ],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        module: 'readonly',
        require: 'readonly',
        GameEngine: 'readonly',
        ExpeditionWorld: 'readonly',
        UnitArt: 'readonly',
        ForestAudio: 'readonly',
        // Declared once in ui-store.js and shared by every interface module, by design.
        Tundra: 'readonly',
        state: 'writable',
        ui: 'readonly',
        prefs: 'readonly',
        records: 'writable',
        audio: 'readonly',
        art: 'readonly',
        escapeHTML: 'readonly',
        E: 'readonly',
        $: 'readonly',
        SAVE: 'readonly',
        PREFS: 'readonly',
        RECORDS: 'readonly',
      },
    },
    ...shared,
  },
  // Node-only tooling: checks, simulations and QA helpers.
  {
    files: ['*.cjs', 'tests/*.cjs'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'commonjs', globals: { ...globals.node } },
    ...shared,
  },
  // game.js is the entry script: its top-level names are the deliberate public surface that
  // index.html and the tests/*-qa.html harnesses drive (state, beginBattle, showDialog, …).
  // Wrapping it in an IIFE would break those pages, so the global-scope rule does not apply.
  {
    files: ['ui-store.js', 'game.js'],
    rules: {
      'no-implicit-globals': 'off',
      // ui-store.js declares the shared bindings the other interface modules read.
      'no-unused-vars': [
        'error',
        {
          varsIgnorePattern: '^(records|art|escapeHTML|audio|SAVE|PREFS|RECORDS)$',
          argsIgnorePattern: '^_',
          caughtErrors: 'none',
        },
      ],
    },
  },
  {
    files: ['eslint.config.mjs'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.node } },
    ...shared,
  },
];
