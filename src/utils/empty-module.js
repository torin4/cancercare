// Empty module to replace 'fs' in browser environment
// The codec modules don't actually use fs in the browser, they use WASM
module.exports = {};
