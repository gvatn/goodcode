const webpack = require('webpack');

module.exports = {
    entry:  './src',
    output: {
        path:     'builds',
        filename: 'bundle.js',
    },
    module: {
      loaders: [
        {
          test: /\.js$/,
          loader: 'babel-loader',
          query: {
            presets: ['es2015']
          },
          include: __dirname + '/src',
        },
        {
          test: /\.scss/,
          loaders: ['style', 'css', 'sass']
        },
        {
          test: /\.html/,
          loader: 'html',
        }
      ],
    },
    plugins: [
        new webpack.optimize.UglifyJsPlugin({
            compress: {
                warnings: false,
            },
            output: {
                comments: false,
            },
        }),
    ]
};
