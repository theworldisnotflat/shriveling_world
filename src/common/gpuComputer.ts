'use strict';
import {internalFormatType} from '../definitions/project';
import {
	TextureOptions,
	BufferInfo,
	FramebufferInfo,
	ProgramInfo,
	addExtensionsToContext,
	createBufferInfoFromArrays,
	createTextures,
	setTextureFromArray,
	resizeFramebufferInfo,
	setAttribInfoBufferFromArray,
	bindFramebufferInfo,
	setBuffersAndAttributes,
	setUniforms,
	drawBufferInfo,
	createProgramInfo,
	createFramebufferInfo,
} from 'twgl.js';

declare class OffscreenCanvas extends HTMLCanvasElement {
	constructor(width: number, height: number);
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

function generateTextureOptions(
	gl: WebGL2RenderingContext,
	texturesType: {[x: string]: internalFormatType}
): {[x: string]: TextureOptions} {
	const resultat: {[x: string]: TextureOptions} = {};
	for (const name in texturesType) {
		if (texturesType.hasOwnProperty(name)) {
			const formatType = texturesType[name];
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
				src,
				internalFormat: gl[formatType],
				height: 1,
				width: 1,
				minMag: gl.NEAREST,
				wrap: gl.CLAMP_TO_EDGE,
			};
		}
	}

	return resultat;
}

export class GPUComputer {
	private static _gl: WebGL2RenderingContext = undefined;
	private static _attributesInfo: BufferInfo = undefined;

	private readonly _fbi: FramebufferInfo = undefined;
	private readonly _attachments: TextureOptions[] = undefined;
	private readonly _programInfo: ProgramInfo = undefined;
	private readonly _texturesOptions: {[x: string]: TextureOptions} = {};
	private readonly _textures: {[x: string]: WebGLTexture} = {};
	private _uniforms: {[x: string]: number | ArrayBufferView} = {};
	private readonly _bufferAttachments: number[] = [];

	public static async GPUComputerFactory(
		fragmentCode: string,
		initTextures: {[x: string]: internalFormatType},
		outputNumber = 1
	): Promise<GPUComputer> {
		if (GPUComputer._gl === undefined) {
			if (typeof OffscreenCanvas === 'undefined') {
				GPUComputer._gl = document.createElement('canvas').getContext('webgl2', {antialias: false});
			} else {
				GPUComputer._gl = new OffscreenCanvas(256, 256).getContext('webgl2', {antialias: false});
			}

			addExtensionsToContext(<WebGLRenderingContext>GPUComputer._gl);
			GPUComputer._attributesInfo = createBufferInfoFromArrays(<WebGLRenderingContext>GPUComputer._gl, {
				position: {numComponents: 2, data: [-1, -1, 1, -1, 1, 1, -1, 1]},
				texture: {numComponents: 2, data: [0, 0, 1, 0, 1, 1, 0, 1]},
				indices: [0, 2, 1, 0, 2, 3],
			});
		}

		const _gl = GPUComputer._gl;
		const texturesOptions = generateTextureOptions(GPUComputer._gl, initTextures);
		return new Promise((resolve, reject) => {
			createTextures(<WebGLRenderingContext>_gl, texturesOptions, (err, texs) => {
				if (err !== undefined) {
					reject(err);
				}

				for (const sub in texturesOptions) {
					if (texturesOptions.hasOwnProperty(sub)) {
						const option = texturesOptions[sub];
						delete option.src;
					}
				}

				resolve(new GPUComputer(fragmentCode, texturesOptions, texs, outputNumber));
			});
		});
	}

	private constructor(
		fragmentCode: string,
		texturesOptions: {[x: string]: TextureOptions},
		textures: {[x: string]: WebGLTexture},
		outputNumber: number
	) {
		this._programInfo = createProgramInfo(<WebGLRenderingContext>GPUComputer._gl, [vertexCode, fragmentCode]);
		this._attachments = [];
		for (let i = 0; i < outputNumber; i++) {
			this._attachments.push({
				internalFormat: GPUComputer._gl.RGBA32F,
				minMag: GPUComputer._gl.NEAREST,
				wrap: GPUComputer._gl.CLAMP_TO_EDGE,
			});
			this._bufferAttachments.push(GPUComputer._gl.COLOR_ATTACHMENT0 + i);
		}

		this._fbi = createFramebufferInfo(<WebGLRenderingContext>GPUComputer._gl, this._attachments, 1, 1);
		this._texturesOptions = texturesOptions;
		this._textures = textures;
	}

	public updateUniforms(value: {[x: string]: number | ArrayBufferView}): void {
		for (const att in value) {
			if (value.hasOwnProperty(att)) {
				this._uniforms[att] = value[att];
			}
		}
	}

	public updateTextures(texs: {
		[x: string]: {src: ArrayBufferView; width: number; height: number; depth?: number};
	}): void {
		for (const att in texs) {
			if (this._texturesOptions.hasOwnProperty(att)) {
				const oldLookup = this._texturesOptions[att];
				const newLookup = texs[att];
				oldLookup.width = newLookup.width;
				oldLookup.height = newLookup.height;
				oldLookup.depth = newLookup.depth;
				setTextureFromArray(<WebGLRenderingContext>GPUComputer._gl, this._textures[att], newLookup.src, oldLookup);
			}
		}
	}

	public calculate(width: number, height: number): Float32Array[] {
		const _gl = GPUComputer._gl;
		const uniforms = Object.assign({}, this._textures, this._uniforms);

		const end: Float32Array[] = [];
		setAttribInfoBufferFromArray(<WebGLRenderingContext>_gl, GPUComputer._attributesInfo.attribs.texture, [
			0,
			0,
			width,
			0,
			width,
			height,
			0,
			height,
		]);
		_gl.useProgram(this._programInfo.program);
		resizeFramebufferInfo(<WebGLRenderingContext>_gl, this._fbi, this._attachments, width, height);
		bindFramebufferInfo(<WebGLRenderingContext>_gl, this._fbi);
		_gl.viewport(0, 0, width, height);
		_gl.clearColor(0, 0, 0, 0);
		_gl.clearDepth(1);
		_gl.clear(_gl.COLOR_BUFFER_BIT | _gl.DEPTH_BUFFER_BIT);

		setBuffersAndAttributes(<WebGLRenderingContext>_gl, this._programInfo, GPUComputer._attributesInfo);
		setUniforms(this._programInfo, uniforms);
		_gl.drawBuffers(this._bufferAttachments);
		drawBufferInfo(<WebGLRenderingContext>_gl, GPUComputer._attributesInfo);
		for (let i = 0; i < this._fbi.attachments.length; i++) {
			const temp = new Float32Array(width * height * 4);
			_gl.readBuffer(_gl.COLOR_ATTACHMENT0 + i);
			_gl.readPixels(0, 0, width, height, _gl.RGBA, _gl.FLOAT, temp);
			end.push(temp);
		}

		bindFramebufferInfo(<WebGLRenderingContext>_gl);
		return end;
	}
}
