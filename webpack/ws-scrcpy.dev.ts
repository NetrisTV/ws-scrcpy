import { frontend, backend } from './ws-scrcpy.common';
import webpack, { ConfigurationFactory } from 'webpack';

const devOpts: webpack.Configuration = {
    devtool: 'inline-source-map',
    mode: 'development',
};

const front: ConfigurationFactory = (env, args) => {
    return Object.assign({}, frontend(env, args), devOpts);
};
const back: ConfigurationFactory = (env, args) => {
    return Object.assign({}, backend(env, args), devOpts);
};

module.exports = [front, back];
