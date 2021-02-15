import { backend, frontend } from './ws-scrcpy.common';
import webpack from 'webpack';

const prodOpts: webpack.Configuration = {
    mode: 'production',
};

const front = Object.assign({}, frontend, prodOpts);
const back = Object.assign({}, backend, prodOpts);

module.exports = [front, back];
