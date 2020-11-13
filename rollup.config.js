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
import * as glsl from 'glslify';
import * as glob from 'glob';
import modify from 'rollup-plugin-modify';
import { readdirSync, readFileSync, outputFileSync, createWriteStream, ensureDirSync, copySync, outputFile } from 'fs-extra';
import { Readable } from 'stream';
import { createDeflate } from 'zlib';
import { execSync } from 'child_process';

import purgecss from "purgecss";
import postcss from 'postcss';
import autoprefixer from 'autoprefixer';
import cssnano from 'cssnano';

const purge = new purgecss();
const post = postcss([autoprefixer({ add: false }), cssnano]);

const mode = process.env.NODE_ENV;
const dev = mode === 'development';
const legacy = !!process.env.SAPPER_LEGACY_BUILD;

const shaderGlob = ['./src/core/shaders/**/*.frag', './src/core/shaders/**/*.vert'];
const datasetDestination = './static/datasets/';

function commentStripper(contents) {
    let newContents = [];
    for (let i = 0; i < contents.length; ++i) {
        let c = contents.charAt(i);
        if (c === '/') {
            c = contents.charAt(++i);
            if (c === '/') {
                while (c !== '\r' && c !== '\n' && i < contents.length) {
                    c = contents.charAt(++i);
                }
            } else if (c === '*') {
                while (i < contents.length) {
                    c = contents.charAt(++i);
                    if (c === '*') {
                        c = contents.charAt(++i);
                        while (c === '*') {
                            c = contents.charAt(++i);
                        }
                        if (c === '/') {
                            c = contents.charAt(++i);
                            break;
                        }
                    }
                }
            } else {
                --i;
                c = '/';
            }
        }
        newContents.push(c);
    }

    newContents = newContents.join('');
    newContents = newContents
        .replace(/\s+$/gm, '')
        .replace(/^\s+/gm, '')
        .replace(/\n+/gm, '\n');
    return newContents;
}

function glob2Array(inputs) {
    const files = [];
    inputs.forEach(path => {
        files.push(...glob.sync(path, { nodir: true }));
    });
    return files;
}

const getDirectories = source =>
    readdirSync(source, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

const folder2dict = source => {
    let result = [];
    readdirSync(source, { withFileTypes: true })
        .filter(dirent => !dirent.isDirectory())
        .map(dirent => dirent.name)
        .forEach(name => {
            result.push({
                name: name,
                text: readFileSync(source + '/' + name, {
                    encoding: 'utf8',
                }),
            });
        });
    return result;
};

const compileShaders = () => {
    const shadersFiles = glob2Array(shaderGlob);
    let shaders = {};
    shadersFiles.forEach(file => {
        let typeShader = file.endsWith('vert') ? 'vertex' : 'fragment';
        let last = file.split('/');
        let name = last[last.length - 1].replace('.frag', '').replace('.vert', '');
        let fileContent = readFileSync(file, 'utf8');
        if (!shaders.hasOwnProperty(name)) {
            shaders[name] = {};
        }
        shaders[name][typeShader] = commentStripper(glsl.compile(fileContent, { basedir: './src/core/shaders' }));
    });
    return shaders;
};

const zipper = () => {
    let datasets = getDirectories('./datasets');
    ensureDirSync(datasetDestination);
    datasets.forEach(directory => {
        let datas = JSON.stringify(folder2dict('./datasets/' + directory + '/'));
        const readableStream = new Readable();
        readableStream._read = () => {};

        let deflate = createDeflate({ level: 9 });
        readableStream.push(datas, 'utf8');
        readableStream.push(null);
        readableStream.pipe(deflate).pipe(createWriteStream(datasetDestination + directory));
    });
    outputFileSync(datasetDestination + 'datasets.json', JSON.stringify(datasets));
};

async function cssPreparation() {
    const purgeCSSResults = await purge.purge({
        content: ["src/**/*.html", "src/**/**/*.svelte", "src/**/**/**.ts", "static/**/**/**.html"],
        css: ["static/**/*.css"],
        fontFace: true,
        variables: true
    });
    await Promise.all(purgeCSSResults.map(async item => {
        let css = (await post.process(item.css, { from: item.file })).css;
        outputFileSync(item.file, css);
    }));
}

const preparerStatic = (options = {}) => {
    const { targets = [], hook = 'buildStart' } = options; // hook = buildStart or hook = buildEnd
    return {
        name: 'preparerStatic',
        [hook]: async() => {
            console.log('lint');
            execSync('eslint src --ext .ts --fix', { stdio: 'inherit' });
            console.log('dataset generation');
            zipper();
            copySync('./src/toStatic/', './static/');
            console.log('documentation generation');
            execSync(`npx typedoc --plugin typedoc-neo-theme \
            --out static/documentation --json static/documentation/json.json  \
            --readme none  --name "shriveling the world documentation" \
            --ignoreCompilerErrors --hideGenerator --target ES6  src/core\
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
                dev,
                hydratable: true,
                preprocess: sveltePreprocess(),
                emitCss: true
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
            // preparerStatic(),
            replace({
                'process.browser': false,
                'process.env.NODE_ENV': JSON.stringify(mode),
            }),
            modify({
                find: /.__SHADERS_HERE__./,
                replace: JSON.stringify(compileShaders())
            }),
            svelte({
                generate: 'ssr',
                hydratable: true,
                preprocess: sveltePreprocess(),
                dev
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

};