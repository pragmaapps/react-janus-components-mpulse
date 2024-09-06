var path = require('path');

module.exports = {
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'react-janus-components.js',
    library: 'reactJanusComponents',
    libraryTarget: 'umd' 
  },
  module: {
    noParse: /^(react|react-dom)$/i,
    rules: [
      {
        test: /\.js$/,
        include: path.resolve(__dirname, 'src'),
        exclude: /(node_modules|bower_components|build)/,
        use: {
          loader: 'babel-loader',
          query: {
            presets: ['babel-preset-env', 'babel-preset-react'],
          }
        },
      },
      {
        test: /\.css$/,
        use: [
          'style-loader',
          'css-loader'
        ]
      }
    ]
  },
  externals: [
    'react',
    'react-dom'
  ]

};