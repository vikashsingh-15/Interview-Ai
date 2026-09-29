// Small syntax/safety check; avoid introducing a stylistic rewrite of legacy code.
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  env: { node: true, es2022: true },
  ignorePatterns: ['dist/', 'node_modules/'],
  rules: { 'no-unreachable': 'error', 'no-dupe-keys': 'error', 'no-constant-condition': 'warn' },
};
