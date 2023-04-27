module.exports = (env, argv) => {
  const path = require('path');
  const webpack = require('webpack');
  const mode = argv.mode;
  const { VueLoaderPlugin } = require('vue-loader');
  const libraryName = process.env.npm_package_name;

  return config = {
    mode: mode,
    context: path.resolve(__dirname, 'src'),
    entry: "./entries/dist.js",
    devtool: (mode === 'production') ? undefined : 'inline-source-map',
    output: {
      path: path.join(__dirname, 'dist'),
      filename: `${libraryName}.js`,
      sourceMapFilename: '[file].map'
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js', '.vue'],
      alias: {
        'vue': '@vue/runtime-dom'
      },
      modules: [
        path.resolve('./src'),
        path.resolve('./node_modules')
      ],
      fallback: {
        util: require.resolve("util/")
      }
    },
    module: {
      rules: [
        {
          test: /\.vue$/,
          loader: 'vue-loader',
          options: {
            preserveWhitespace: false,
          },
        },
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: 'babel-loader'
        },
        {
          test: /\.(s[ac]ss|css)$/,
          use: [
            'vue-style-loader',
            'css-loader',
            'sass-loader'
          ]
        },
        {
          test: /\.(svg)$/,
          include: path.join(__dirname, 'src/images'),
          use: [
            {
              loader: 'url-loader',
              options: {
                limit: 10000
              }
            }
          ]
        } // inline base64 URLs for <=10k images, direct URLs for the rest
      ]
    },
    plugins: [
      new VueLoaderPlugin(),
      new webpack.DefinePlugin({
        'process.env': JSON.stringify(process.env),
        'process.env.NODE_ENV': JSON.stringify(mode)
      }),
    ]
  };
};
