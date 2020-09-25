const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const nodeExternals = require('webpack-node-externals');
const path = require('path');

const common = {
  mode: 'development',
  devtool: 'inline-source-map',
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: [MiniCssExtractPlugin.loader, 'css-loader'],
      },
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.worker\.js$/,
        use: { loader: 'worker-loader' }
      },
      {
        test: /\.svg$/,
        loader: 'svg-inline-loader'
      },
      {
        test: /\.(png|jpe?g|gif)$/i,
        use: [
          {
            loader: 'file-loader',
          },
        ],
      },
      {
        test: /\.(asset)$/i,
        use: [
          {
            loader: 'file-loader',
            options: {
              name: '[name]',
            },
          },
        ],
      }
    ]
  },
  resolve: {
    extensions: [ '.tsx', '.ts', '.js' ],
  },

}

const frontend = {
  entry: './src/app/index.ts',
  externals: ['fs'],
  plugins: [
    new HtmlWebpackPlugin({
      template: __dirname + "/src/public/index.html",
      inject: 'head'
    }),
    new MiniCssExtractPlugin()
  ],
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist/public'),
  },
};

const backend = {
  entry: './src/server/index.ts',
  externals: [nodeExternals()],
  devtool: 'inline-source-map',
  mode: 'development',
  node: {
    global: false,
    __filename: false,
    __dirname: false,
  },
  output: {
    filename: 'index.js',
    path: path.resolve(__dirname, 'dist/server'),
  },
  target: 'node',
}

module.exports = [
  Object.assign({} , common, frontend),
  Object.assign({} , common, backend)
];
