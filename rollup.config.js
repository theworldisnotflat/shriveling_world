import path from 'path';
import resolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import commonjs from '@rollup/plugin-commonjs';
import url from '@rollup/plugin-url';
import svelte from 'rollup-plugin-svelte';
import babel from '@rollup/plugin-babel';
import { terser } from 'rollup-plugin-terser';
import sveltePreprocess from 'svelte-preprocess';
import typescript from '@rollup/plugin-typescript';
import config from 'sapper/config/rollup.js';
import json from '@rollup/plugin-json';
import pkg from './package.json';

import { zipper } from './rollupScripts/zipper';
import { cssPreparation } from './rollupScripts/cssPreparation';
import { glob2Array, compileShaders } from './rollupScripts/shaderCompiler';

import modify from 'rollup-plugin-modify';
import { readFileSync, copySync, outputFile } from 'fs-extra';
import { execSync } from 'child_process';

const mode = process.env.NODE_ENV;
const dev = mode === 'development';
const legacy = !!process.env.SAPPER_LEGACY_BUILD;

const preparerStatic = (options = {}) => {
    const { targets = [], hook = 'buildStart' } = options; // hook = buildStart or hook = buildEnd
    return {
        name: 'preparerStatic',
        [hook]: async() => {
            console.log('lint');
            execSync('eslint src --ext .ts --fix', { stdio: 'inherit' });
            console.log('dataset generation');
            zipper();
            pkg.toCopy.forEach(item => copySync(item.in, item.out));
            console.log('documentation generation');
            execSync(`npx typedoc --plugin typedoc-neo-theme \
            --out static/documentation  \
            --externalPattern node_module\
            --readme markdown/devdoc/README_DEVDOC.md  --name "Shriveling world developer documentation" \
            --hideGenerator  src/application/bigBoard/bigBoard.ts\
            && cp -r static/documentation/* static && mv static/index.html static/documentation.html\
            && rm -Rf static/documentation`, { stdio: 'inherit' });
            console.log('update documentation');
            const htmls = glob2Array(['static/**/**.html']);
            let regex = /index.html/g;
            htmls.map(html => {
                let fileContent = readFileSync(html, 'utf8');
                fileContent = fileContent.replace(regex, 'documentation.html');
                outputFile(html, fileContent);
            });
            console.log('css compression');
            await cssPreparation();
            console.log('end');
        }
    };
};

const onwarn = (warning, onwarn) =>
    (warning.code === 'MISSING_EXPORT' && /'preload'/.test(warning.message)) ||
    (warning.code === 'CIRCULAR_DEPENDENCY' && /[/\\]@sapper[/\\]/.test(warning.message)) ||
    (warning.code === 'THIS_IS_UNDEFINED') ||
    onwarn(warning);

export default {
    client: {
        input: config.client.input().replace(/\.js$/, '.ts'),
        output: config.client.output(),
        plugins: [
            json(),
            preparerStatic(),
            replace({
                'process.browser': true,
                'process.env.NODE_ENV': JSON.stringify(mode),
            }),
            modify({
                find: /.__SHADERS_HERE__./,
                replace: JSON.stringify(compileShaders())
            }),
            svelte({
                preprocess: sveltePreprocess(),
                compilerOptions: {
                    dev,
                    hydratable: true
                }
            }),
            url({
                sourceDir: path.resolve(__dirname, 'src/node_modules/images'),
                publicPath: '/client/'
            }),
            resolve({
                browser: true,
                dedupe: ['svelte']
            }),
            commonjs(),
            typescript({ sourceMap: dev }),

            legacy && babel({
                extensions: ['.js', '.mjs', '.html', '.svelte'],
                babelHelpers: 'runtime',
                exclude: ['node_modules/@babel/**'],
                presets: [
                    ['@babel/preset-env', {
                        targets: '> 0.25%, not dead'
                    }]
                ],
                plugins: [
                    '@babel/plugin-syntax-dynamic-import', ['@babel/plugin-transform-runtime', {
                        useESModules: true
                    }]
                ]
            }),

            !dev && terser({
                module: true
            })
        ],

        preserveEntrySignatures: false,
        onwarn,
    },

    server: {
        input: { server: config.server.input().server.replace(/\.js$/, ".ts") },
        output: config.server.output(),
        plugins: [
            json(),
            replace({
                'process.browser': false,
                'process.env.NODE_ENV': JSON.stringify(mode),
            }),
            modify({
                find: /.__SHADERS_HERE__./,
                replace: JSON.stringify(compileShaders())
            }),
            svelte({
                preprocess: sveltePreprocess(),
                compilerOptions: {
                    dev,
                    generate: 'ssr',
                    hydratable: true
                },
                emitCss: false
            }),
            url({
                sourceDir: path.resolve(__dirname, 'src/node_modules/images'),
                publicPath: '/client/',
                emitFiles: false // already emitted by client build
            }),
            resolve({
                dedupe: ['svelte']
            }),
            commonjs(),
            typescript({ sourceMap: dev })
        ],
        external: Object.keys(pkg.dependencies).concat(require('module').builtinModules),

        preserveEntrySignatures: 'strict',
        onwarn,
    },
    serviceworker: {
        input: config.serviceworker.input().replace(/\.js$/, '.ts'),
        output: config.serviceworker.output(),
        plugins: [
            resolve(),
            replace({
                'process.browser': true,
                'process.env.NODE_ENV': JSON.stringify(mode)
            }),
            commonjs(),
            typescript({ sourceMap: dev }), !dev && terser()
        ],

        preserveEntrySignatures: false,
        onwarn,
    }

};