import nodeExternals from 'webpack-node-externals';
import fs from 'fs';
import path from 'path';
import process from 'process';
import webpack from 'webpack';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import GeneratePackageJsonPlugin from 'generate-package-json-webpack-plugin';

export const PROJECT_ROOT = path.resolve(__dirname, '..');
export const SERVER_DIST_PATH = path.join(PROJECT_ROOT, 'dist');
export const CLIENT_DIST_PATH = path.join(PROJECT_ROOT, 'dist/public');
const PACKAGE_JSON = path.join(PROJECT_ROOT, 'package.json');
const INCLUDE_APPL = !!process.env.INCLUDE_APPL;
const INCLUDE_GOOG = !!process.env.INCLUDE_GOOG;

export const common: webpack.Configuration = {
    module: {
        rules: [
            {
                test: /\.css$/i,
                use: [MiniCssExtractPlugin.loader, 'css-loader'],
            },
            {
                test: /\.tsx?$/,
                use: [
                    { loader: 'ts-loader' },
                    {
                        loader: 'ifdef-loader',
                        options: {
                            INCLUDE_APPL,
                            INCLUDE_GOOG,
                        },
                    },
                ],
                exclude: /node_modules/,
            },
            {
                test: /\.worker\.js$/,
                use: { loader: 'worker-loader' },
            },
            {
                test: /\.svg$/,
                loader: 'svg-inline-loader',
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
            },
            {
                include: path.resolve(PROJECT_ROOT, 'vendor/Genymobile'),
                use: [
                    {
                        loader: 'file-loader',
                        options: {
                            name: '[path][name].[ext]',
                        },
                    },
                ],
            },
        ],
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
    },
};

const front: webpack.Configuration = {
    entry: path.join(PROJECT_ROOT, './src/app/index.ts'),
    externals: ['fs'],
    plugins: [
        new HtmlWebpackPlugin({
            template: path.join(PROJECT_ROOT, '/src/public/index.html'),
            inject: 'head',
        }),
        new MiniCssExtractPlugin(),
    ],
    output: {
        filename: 'bundle.js',
        path: CLIENT_DIST_PATH,
    },
};

export const frontend = Object.assign({}, common, front);

const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON).toString());
const { name, version, description, author, license, scripts } = packageJson;
const basePackage = {
    name,
    version,
    description,
    author,
    license,
    scripts: { start: scripts['script:dist:start'] },
};
delete packageJson.dependencies;
delete packageJson.devDependencies;

const back: webpack.Configuration = {
    entry: path.join(PROJECT_ROOT, './src/server/index.ts'),
    externals: [nodeExternals()],
    plugins: [new GeneratePackageJsonPlugin(basePackage)],
    node: {
        global: false,
        __filename: false,
        __dirname: false,
    },
    output: {
        filename: 'index.js',
        path: SERVER_DIST_PATH,
    },
    target: 'node',
};

export const backend = Object.assign({}, common, back);
