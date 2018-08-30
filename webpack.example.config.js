'use strict'

const Uglify = require('uglifyjs-webpack-plugin')
const path = require('path')

const uglifyOptions = {
  uglifyOptions: {
    mangle: false,
    compress: false,
  },
}

module.exports = {
  entry: './examples/browser/index.js',
  output: {
    filename: './examples/browser/bundle.js'
  },
  target: 'web',
  devtool: 'none',
  node: {
    console: false,
    process: 'mock',
    Buffer: true
  },
  plugins: [
    new Uglify(uglifyOptions),
  ],
  externals: {
    fs: '{}',
  },
  resolve: {
    modules: [
      'node_modules',
      path.resolve(__dirname, '../node_modules')
    ],
  },
  resolveLoader: {
    modules: [
      'node_modules',
      path.resolve(__dirname, '../node_modules')
    ],
    moduleExtensions: ['-loader']
  },
  module: {
    rules: [{
      test: /\.json$/,
      loader: 'json-loader'
    }]
  }
}
