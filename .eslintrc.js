module.exports = {
  env: {
    node: true,
    commonjs: true,
    es2020: true,
  },
  extends: 'eslint:recommended',
  parserOptions: {
    ecmaVersion: 11,
  },
  rules: {},
  globals: {
    test: true,
    httpBackend: true,
    suite: true,
    expect: true,
    fetch: true,
    context: true,
  },
}
