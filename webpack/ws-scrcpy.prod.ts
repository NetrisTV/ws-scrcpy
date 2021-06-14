import { backend, frontend } from './ws-scrcpy.common';
import webpack, { ConfigurationFactory } from 'webpack';

const prodOpts: webpack.Configuration = {
    mode: 'production',
};

const front: ConfigurationFactory = (env, args) => {
    return Object.assign({}, frontend(env, args), prodOpts);
};
const back: ConfigurationFactory = (env, args) => {
    return Object.assign({}, backend(env, args), prodOpts);
};

module.exports = [front, back];
