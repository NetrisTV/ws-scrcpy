import { backend, frontend } from './ws-scrcpy.common';
import webpack from 'webpack';

const prodOpts: webpack.Configuration = {
    mode: 'production',
};

const front = () => {
    // Fetch the base frontend configuration
    const baseFrontend = frontend();

    // Ensure the resolve object and its fallbacks exist safely without overriding existing configs
    baseFrontend.resolve = baseFrontend.resolve || {};
    baseFrontend.resolve.fallback = Object.assign({}, baseFrontend.resolve.fallback, {
        // Force webpack 5 to resolve the 'events' node module using the installed polyfill
        events: require.resolve('events/'),
    });

    // Merge with production modifications
    return Object.assign({}, baseFrontend, prodOpts);
};

const back = () => {
    return Object.assign({}, backend(), prodOpts);
};

module.exports = [front, back];
