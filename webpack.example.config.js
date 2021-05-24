'use strict'

const path = require('path')
const webpack = require('webpack')

module.exports = {
  entry: './examples/entry.js',
  output: {
    libraryTarget: 'global',
    filename: '../examples/browser/bundle.js'
  },
  target: 'web',
  devtool: 'source-map',
  plugins: [
    new webpack.IgnorePlugin(/mongo|redis/)
  ],
  externals: {
    fs: '{}',
    fatfs: '{}',
    'fs-extra': '{ copy: () => {} }',
    rimraf: '{ sync: () => {} }',
    'idb-readable-stream': '{}',
    runtimejs: '{}',
    net: '{}',
    child_process: {},
    dns: '{}',
    tls: '{}',
    bindings: '{}'
  },
  resolve: {
    modules: [
      'node_modules',
      path.resolve(__dirname, '../node_modules')
    ],
    fallback: {
      "path": require.resolve("path-browserify"),
      "stream": require.resolve("stream-browserify")
    }
  }
}
