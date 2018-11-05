'use strict'

const glob = require('glob');
const webpack = require('webpack')
const Uglify = require('uglifyjs-webpack-plugin')
const path = require('path')

const uglifyOptions = {
  uglifyOptions: {
    mangle: false,
    compress: false,
  },
}

module.exports = {
  // TODO: put all tests in a .js file that webpack can use as entry point
  entry: glob.sync('./test/*.spec.js'),
  output: {
    filename: './test/browser/bundle.js'
  },
  target: 'web',
  devtool: 'none',
  node: {
    console: false,
    process: 'mock',
    Buffer: true
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env': {
        'NODE_ENV': JSON.stringify(process.env.NODE_ENV)
      }
    }),
    // new Uglify(uglifyOptions),
  ],
  externals: {
    fs: '{}',
    rimraf: '{ sync: () => {} }',
  },
  resolve: {
    modules: [
      'node_modules',
      path.resolve(__dirname, '../node_modules')
    ]
  },
  resolveLoader: {
    modules: [
      'node_modules',
      path.resolve(__dirname, '../node_modules')
    ],
    moduleExtensions: ['-loader']
  },
  module: {
    rules: [
      {
        test: /\.json$/,
        loader: 'json-loader'
      },
      // For inlining the fixture keys in browsers tests
      {
        test: /userA|userB|userC|userD$/,
        loader: 'json-loader'
      }
    ]
  }
}
