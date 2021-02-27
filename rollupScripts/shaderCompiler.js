import nodeGles from 'node-gles';
import { addExtensionsToContext } from 'twgl.js';
import * as glsl from 'glslify';
import * as glob from 'glob';
import { readFileSync } from 'fs-extra';

const gl = nodeGles.createWebGLRenderingContext();
addExtensionsToContext(gl);
const errorReg = /\d+:(\d+): /g;

const shaderGlob = [__dirname + '/src/application/shaders/**/*.frag', __dirname + '/src/application/shaders/**/*.vert'];

function testSharder(text = '', isFragment = true) {
    const shaderType = isFragment ? gl.FRAGMENT_SHADER : gl.VERTEX_SHADER;
    const shader = gl.createShader(shaderType);
    gl.shaderSource(shader, text);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const errAccumlator = {};
        gl.getShaderInfoLog(shader)
            .split('\n')
            .forEach((line) => {
                [...line.matchAll(errorReg)].map((m) => {
                    const num = Number.parseInt(m[1]);
                    if (!errAccumlator.hasOwnProperty(num)) {
                        errAccumlator[num] = [];
                    }
                    errAccumlator[num].push(line);
                });
            });
        let sortie = '';
        text.split('\n').forEach((line, i, arr) => {
            const lineNumber = i + 1;
            if (errAccumlator.hasOwnProperty(lineNumber)) {
                for (let j = Math.max(0, i - 5); j < lineNumber; j++) {
                    sortie += `\n${j + 1} : ${arr[j]}`;
                }
                sortie += '\n~~~~~~~~~~~~~~~~~~~~~~~~';
                errAccumlator[lineNumber].forEach((err) => {
                    sortie += `\n${err}`;
                });
            }
        });
        sortie += '\n\n' + text;
        throw sortie;
    }
}

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
    newContents = newContents.replace(/\s+$/gm, '').replace(/^\s+/gm, '').replace(/\n+/gm, '\n');
    return newContents;
}

export function glob2Array(inputs) {
    const files = [];
    inputs.forEach((path) => {
        files.push(...glob.sync(path, { nodir: true }));
    });
    return files;
}

export function compileShaders() {
    const shadersFiles = glob2Array(shaderGlob);
    let shaders = {};
    shadersFiles.forEach((file) => {
        let typeShader = file.endsWith('vert') ? 'vertex' : 'fragment';
        let last = file.split('/');
        let name = last[last.length - 1].replace('.frag', '').replace('.vert', '');
        let fileContent = readFileSync(file, 'utf8');
        if (!shaders.hasOwnProperty(name)) {
            shaders[name] = {};
        }
        const temp = glsl.compile(fileContent, { basedir: __dirname + '/src/application/shaders' });

        // try {
        //     testSharder(temp, typeShader === 'fragment');
        // } catch (error) {
        //     throw file + '\n' + error;
        // }
        shaders[name][typeShader] = commentStripper(temp);
    });
    return shaders;
}