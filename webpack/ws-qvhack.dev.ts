import { frontend } from './ws-qvhack.common';
import webpack from 'webpack';

const devOpts: webpack.Configuration = {
    devtool: 'inline-source-map',
    mode: 'development',
};

module.exports = Object.assign({}, frontend, devOpts);
