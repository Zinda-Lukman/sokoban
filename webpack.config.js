const webpack = require('webpack');
require('dotenv').config();

module.exports = {
  entry: "./lib/sokoban.js",
  output: {
    filename: "./dist/bundle.js"
  },
  devtool: "source-map",
  plugins: [
    new webpack.DefinePlugin({
      'process.env.VITE_API_BASE_URL': JSON.stringify(process.env.VITE_API_BASE_URL || process.env.API_BASE_URL || 'https://sokoban-cloudflare-api.lookmans.workers.dev'),
      'process.env.VITE_CLIENT_API_KEY': JSON.stringify(process.env.VITE_CLIENT_API_KEY || process.env.CLIENT_API_KEY || 'replace-with-your-client-api-key')
    })
  ]
};
