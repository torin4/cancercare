const webpack = require("webpack");
const path = require("path");

module.exports = function override(config) {
  const fallback = config.resolve.fallback || {};
  Object.assign(fallback, {
    crypto: require.resolve("crypto-browserify"),
    stream: require.resolve("stream-browserify"),
    assert: require.resolve("assert"),
    http: require.resolve("stream-http"),
    https: require.resolve("https-browserify"),
    os: require.resolve("os-browserify"),
    url: require.resolve("url"),
    path: require.resolve("path-browserify"),
    process: require.resolve("process/browser"),
    fs: path.resolve(__dirname, 'src/utils/empty-module.js'),
    zlib: false,
    net: false,
    tls: false,
  });
  config.resolve.fallback = fallback;
  
  // Add alias for fs
  config.resolve.alias = config.resolve.alias || {};
  config.resolve.alias['fs'] = path.resolve(__dirname, 'src/utils/empty-module.js');
  
  config.plugins = (config.plugins || []).concat([
    new webpack.ProvidePlugin({
      process: require.resolve("process/browser"),
      Buffer: ["buffer", "Buffer"],
    }),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    }),
  ]);
  
  // SharedArrayBuffer support: Configure dev server headers for zero-copy transfers
  // These headers are required for SharedArrayBuffer to work in browsers
  // Note: For production, these headers must also be set on the web server (Nginx/Apache/Vercel)
  // See SHAREDARRAYBUFFER_SETUP.md for production configuration
  config.devServer = config.devServer || {};
  config.devServer.headers = config.devServer.headers || {};
  config.devServer.headers['Cross-Origin-Opener-Policy'] = 'same-origin';
  config.devServer.headers['Cross-Origin-Embedder-Policy'] = 'require-corp';
  
  // Suppress all warnings about fs and path in codec modules
  // These modules use WASM and don't actually need fs/path in browser
  config.ignoreWarnings = [
    { module: /node_modules\/@cornerstonejs\/codec-/ },
    { message: /Can't resolve 'fs'/ },
    { message: /Can't resolve 'path'/ },
    /Failed to parse source map/,
  ];
  
  return config;
};
