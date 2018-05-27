///<reference path="../definitions/twgl.d.ts"/>
declare class OffscreenCanvas extends HTMLCanvasElement {
    constructor(width: number, height: number);
}

namespace shriveling {
    'use strict';
    export type internalFormatType =
        'R8' | 'R32F' | 'R16UI' | 'R16I' | 'R32UI' | 'R32I' |
        'RG8' | 'RG32F' | 'RG16UI' | 'RG16I' | 'RG32UI' | 'RG32I' |
        'RGB8' | 'RGB32F' | 'RGB16UI' | 'RGB16I' | 'RGB32UI' | 'RGB32I' |
        'RGBA8' | 'RGBA32F' | 'RGBA16UI' | 'RGBA16I' | 'RGBA32UI' | 'RGBA32I';

    export interface IDimension {
        width: number;
        height: number;
    }
    const vertexCode =
        '#version 300 es\n' +
        'in vec2 position;\n' +
        'in vec2 texture;\n' +
        'out vec2 pos;\n' +

        'void main(void) {\n' +
        '  pos = texture;\n' +
        '  gl_Position = vec4(position.xy, 0.0, 1.0);\n' +
        '}\n';

    function generateTextureOptions
        (gl: WebGL2RenderingContext, texturesType: { [x: string]: internalFormatType }): { [x: string]: twgl.TextureOptions } {
        let resultat: { [x: string]: twgl.TextureOptions } = {};
        for (let name in texturesType) {
            if (texturesType.hasOwnProperty(name)) {
                let formatType = texturesType[name];
                let multiplier = 1;
                let src: ArrayBufferView;
                if (formatType.startsWith('RGBA')) {
                    multiplier = 4;
                } else if (formatType.startsWith('RGB')) {
                    multiplier = 3;
                } else if (formatType.startsWith('RG')) {
                    multiplier = 2;
                }
                if (formatType.endsWith('8')) {
                    src = new Uint8Array(multiplier);
                } else if (formatType.endsWith('32F')) {
                    src = new Float32Array(multiplier);
                } else if (formatType.endsWith('16UI')) {
                    src = new Uint16Array(multiplier);
                } else if (formatType.endsWith('16I')) {
                    src = new Int16Array(multiplier);
                } else if (formatType.endsWith('32UI')) {
                    src = new Uint32Array(multiplier);
                } else if (formatType.endsWith('32I')) {
                    src = new Int32Array(multiplier);
                }
                resultat[name] = {
                    src: src, internalFormat: gl[formatType], height: 1, width: 1, minMag: gl.NEAREST, wrap: gl.CLAMP_TO_EDGE,
                };
            }
        }
        return resultat;
    }

    export class GPUComputer {
        private static _gl: WebGL2RenderingContext = undefined;
        private static _attributesInfo: twgl.BufferInfo = undefined;

        private _fbi: twgl.FramebufferInfo = undefined;
        private _attachments: twgl.TextureOptions[] = undefined;
        private _programInfo: twgl.ProgramInfo = undefined;
        private _texturesOptions: { [x: string]: twgl.TextureOptions } = {};
        private _textures: { [x: string]: WebGLTexture } = {};
        private _uniforms: { [x: string]: number | ArrayBufferView } = {};
        private _bufferAttachments: number[] = [];

        public static GPUComputerFactory
            (fragmentCode: string, initTextures: { [x: string]: internalFormatType }, outputNumber: number = 1): Promise<GPUComputer> {
            if (GPUComputer._gl === undefined) {
                if (typeof OffscreenCanvas === 'undefined') {
                    GPUComputer._gl = document.createElement('canvas').getContext('webgl2', { antialias: false });
                } else {
                    GPUComputer._gl = (new OffscreenCanvas(256, 256)).getContext('webgl2', { antialias: false });
                }
                twgl.addExtensionsToContext(GPUComputer._gl);
                GPUComputer._attributesInfo = twgl.createBufferInfoFromArrays(GPUComputer._gl, {
                    position: { numComponents: 2, data: [-1, -1, 1, -1, 1, 1, -1, 1] },
                    texture: { numComponents: 2, data: [0, 0, 1, 0, 1, 1, 0, 1] },
                    indices: [0, 2, 1, 0, 2, 3],
                });

            }
            const _gl = GPUComputer._gl;
            let texturesOptions = generateTextureOptions(GPUComputer._gl, initTextures);
            return new Promise((resolve, reject) => {
                twgl.createTextures(_gl, texturesOptions, (err, texs) => {
                    if (err !== undefined) {
                        reject(err);
                    }
                    for (let sub in texturesOptions) {
                        if (texturesOptions.hasOwnProperty(sub)) {
                            let option = texturesOptions[sub];
                            delete option.src;
                        }
                    }
                    resolve(new GPUComputer(fragmentCode, texturesOptions, texs, outputNumber));
                });
            });
        }

        public updateUniforms(value: { [x: string]: number | ArrayBufferView }): void {
            for (let att in value) {
                if (value.hasOwnProperty(att)) {
                    this._uniforms[att] = value[att];
                }
            }
        }

        public updateTextures(texs: { [x: string]: { src: ArrayBufferView, width: number, height: number, depth?: number } }): void {
            for (let att in texs) {
                if (this._texturesOptions.hasOwnProperty(att)) {
                    let oldLookup = this._texturesOptions[att];
                    let newLookup = texs[att];
                    oldLookup.width = newLookup.width;
                    oldLookup.height = newLookup.height;
                    oldLookup.depth = newLookup.depth;
                    twgl.setTextureFromArray(GPUComputer._gl, this._textures[att], newLookup.src, oldLookup);
                }
            }
        }

        public calculate(width: number, height: number): Float32Array[] {
            let _gl = GPUComputer._gl;
            let uniforms = Object.assign({}, this._textures, this._uniforms);

            let end: Float32Array[] = [];
            twgl.setAttribInfoBufferFromArray(_gl, GPUComputer._attributesInfo.attribs.texture, [0, 0, width, 0, width, height, 0, height]);
            _gl.useProgram(this._programInfo.program);
            twgl.resizeFramebufferInfo(_gl, this._fbi, this._attachments, width, height);
            twgl.bindFramebufferInfo(_gl, this._fbi);
            _gl.viewport(0, 0, width, height);
            _gl.clearColor(0, 0, 0, 0);
            _gl.clearDepth(1.0);
            _gl.clear(_gl.COLOR_BUFFER_BIT | _gl.DEPTH_BUFFER_BIT);

            twgl.setBuffersAndAttributes(_gl, this._programInfo, GPUComputer._attributesInfo);
            twgl.setUniforms(this._programInfo, uniforms);
            _gl.drawBuffers(this._bufferAttachments);
            twgl.drawBufferInfo(_gl, GPUComputer._attributesInfo);
            for (let i = 0; i < this._fbi.attachments.length; i++) {
                let temp = new Float32Array(width * height * 4);
                _gl.readBuffer(_gl.COLOR_ATTACHMENT0 + i);
                _gl.readPixels(0, 0, width, height, _gl.RGBA, _gl.FLOAT, temp);
                end.push(temp);
            }
            twgl.bindFramebufferInfo(_gl);
            return end;
        }

        private constructor(
            fragmentCode: string,
            texturesOptions: { [x: string]: twgl.TextureOptions },
            textures: { [x: string]: WebGLTexture },
            outputNumber: number) {
            this._programInfo = twgl.createProgramInfo(GPUComputer._gl, [vertexCode, fragmentCode]);
            this._attachments = [];
            for (let i = 0; i < outputNumber; i++) {
                this._attachments.push({
                    internalFormat: GPUComputer._gl.RGBA32F,
                    minMag: GPUComputer._gl.NEAREST,
                    wrap: GPUComputer._gl.CLAMP_TO_EDGE,
                });
                this._bufferAttachments.push(GPUComputer._gl.COLOR_ATTACHMENT0 + i);
            }
            this._fbi = twgl.createFramebufferInfo(GPUComputer._gl, this._attachments, 1, 1);
            this._texturesOptions = texturesOptions;
            this._textures = textures;
        }

    }
}
