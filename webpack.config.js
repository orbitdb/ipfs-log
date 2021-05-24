'use strict'

const path = require('path')

module.exports = {
  entry: './src/log.js',
  output: {
    libraryTarget: 'var',
    library: 'Log',
    filename: 'ipfslog.min.js'
  },
  target: 'web',
  devtool: 'source-map',
  plugins: [
  ],
  resolve: {
    modules: [
      'node_modules',
      path.resolve(__dirname, '../node_modules')
    ]
  }
}
