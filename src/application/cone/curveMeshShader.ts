'use strict';
import { BufferGeometry, InterleavedBufferAttribute, InterleavedBuffer, Line, Material, DynamicDrawUsage } from 'three';
import { CONFIGURATION } from '../common/configuration';
import { getShader } from '../shaders';
import { GPUComputer } from '../common/gpuComputer';
import type { ILookupCurves, CURVESPOSITION_ENUM } from '../definitions/project';

let _curves: CurveMeshShader[];

let curvesDonTDisplay: CurveMeshShader[] = [];
let uuid: string;
let _ready = false;
let _width: number;
let _height: number;
// Should be 1 for testing purposes
// affects the value of the height of edges
let _coefficient = 1;

const _gpgpu: { [x: string]: GPUComputer } = {};

let _t: Float32Array;
let _heightTab: Float32Array;

function fullCleanArrays(): void {
	_t = new Float32Array(0);
	_heightTab = new Float32Array(0);
}

fullCleanArrays();
/**
 *
 * formulas of the height of links function of '[[theta]]' and '[[ratio]]'
 * * '[[speedRatio]]' is computed in function '[[getSpeedRatio]]' in file [[bigBoard/merger.ts]]
 * * '[[speedRatio]]' is computed with [two formulas](https://timespace.hypotheses.org/121)
 * depending on '[[theta]]' compared with '[[thetaLimit]]'
 *
 * * below [[thetaLimit]]: ![below](http://bit.ly/2Xu3kGF)
 * * beyond [[thetaLimit]]: ![beyond](http://bit.ly/2EejFpW)
 * * the figure: ![2](http://bit.ly/2H4FOKw)
 *
 * @param speedRatio
 * @param theta
 */
function getHeight(speedRatio: number, theta: number, curvesPosition: CURVESPOSITION_ENUM): number {
	const semiTheta = theta / 2;
	const sinSemiTheta = Math.sin(semiTheta);
	const cosSemiTheta = Math.cos(semiTheta);
	const secondTerm = Math.sqrt(speedRatio * speedRatio - sinSemiTheta * sinSemiTheta);
	const thirdTerm = 0;
	// The equation of length om'
	const result = (cosSemiTheta + secondTerm + thirdTerm) * CONFIGURATION.earthRadiusMeters * _coefficient;
	// Minus earth radius to compute cm'
	switch (curvesPosition) {
		case 0: // above the surface of the earth
			return result - CONFIGURATION.earthRadiusMeters;
		case 1: // below
			return -(result - CONFIGURATION.earthRadiusMeters);
		case 2:
			return -(result - CONFIGURATION.earthRadiusMeters);
		case 3:
			return -(result - CONFIGURATION.earthRadiusMeters);
	}
}

/**
 * Step is the number of facets forming the cones, default value is 15
 *
 * higher values will consume processor load
 */
function regenerateStep(): void {
	const step = 1 / CONFIGURATION.pointsPerCurve;
	const t: number[] = [];
	for (let i = 0; i < 1; i += step) {
		t.push(i);
	}

	t.push(1);
	_t = new Float32Array(t);
	_width = _t.length;
	const options = {
		u_tSample: { src: _t, width: _width, height: 1 },
	};
	_gpgpu.positions.updateTextures(options);
}

/**
 * Update curves height based on the reference year
 */
function updateYear(): void {
	const year = CONFIGURATION.year;
	curvesDonTDisplay = [];
	for (let i = 0; i < _height; i++) {
		if (!_curves[i].isAvailable(year)) {
			curvesDonTDisplay.push(_curves[i]);
		}
	}
}

function updatePosition(): void {
	for (let i = 0; i < _height; i++) {
		_curves[i].isAvailable(CONFIGURATION.year);
	}
}

function computation(transName?: any): void {
	const uniforms: { [x: string]: number | ArrayBufferView } = {};
	uniforms.longueurMaxi = CONFIGURATION.extrudedHeight;
	uniforms.threeRadius = CONFIGURATION.THREE_EARTH_RADIUS;
	uniforms.earthRadius = CONFIGURATION.earthRadiusMeters;
	uniforms.referenceEquiRectangular = CONFIGURATION.referenceEquiRectangularArray;
	uniforms.representationInit = CONFIGURATION.projectionInit;
	uniforms.representationEnd = CONFIGURATION.projectionEnd;
	uniforms.percentRepresentation = CONFIGURATION.percentProjection;
	uniforms.conesShape = CONFIGURATION.conesShape;
	uniforms.standardParallel1 = CONFIGURATION.standardParallel1;
	uniforms.standardParallel2 = CONFIGURATION.standardParallel2;
	uniforms.coefficient = _coefficient;
	uniforms.zCoeff = CONFIGURATION.zCoeff;
	_gpgpu.positions.updateUniforms(uniforms);
	const options = {
		u_height: { src: _heightTab, width: 1, height: _height },
	};
	_gpgpu.positions.updateTextures(options);
	const tempo = _gpgpu.positions.calculate(_width, _height);
	const allPositions = tempo[0];
	for (let i = 0; i < _height; i++) {
		if (transName) {
			if (_curves[i].transportName == transName) {
				_curves[i].setGeometry(allPositions.subarray(i * _width * 4, (i + 1) * _width * 4));
			}
		} else {
			_curves[i].setGeometry(allPositions.subarray(i * _width * 4, (i + 1) * _width * 4));
		}
	}
}

export class CurveMeshShader extends Line {
	public begin: string | number;
	public end: string | number;
	private readonly theta: number;
	private readonly _years: { [year: string]: number };
	private readonly _transportName: string;
	private _speedRatio: number;
	private _curvePosition: CURVESPOSITION_ENUM;
	private _pointsPerCurve: number;

	public static async generateCones(lookup: ILookupCurves): Promise<CurveMeshShader[]> {
		_ready = false;
		_curves = [];
		fullCleanArrays();
		const promise = new Promise((resolve) => {
			if (uuid === undefined) {
				void Promise.all([
					GPUComputer.GPUComputerFactory(
						getShader('lineMeshShader', 'fragment'),
						{
							u_tSample: 'R32F',
							u_PControls0: 'RGB32F',
							u_PControls1: 'RGB32F',
							u_PControls2: 'RGB32F',
							u_PControls3: 'RGB32F',
							u_height: 'R32F',
						},
						1
					).then((instance) => {
						_gpgpu.positions = instance;
						return instance;
					}),
				]).then(() => {
					uuid = CONFIGURATION.addEventListener(
						'heightRatio intrudedHeightRatio  referenceEquiRectangular THREE_EARTH_RADIUS ' +
							'projectionBegin projectionEnd projectionPercent year',
						(name: string) => {
							if (_ready) {
								switch (name) {
									case 'year':
										updateYear();
										computation();
										break;
									default:
										computation();
								}
							}
						}
					);
					resolve(0);
				});
			} else {
				resolve(0);
			}
		});

		await promise;
		const pControls0: number[] = [];
		const pControls1: number[] = [];
		const pControls2: number[] = [];
		const pControls3: number[] = [];
		for (const cityCodeBegin in lookup) {
			if (lookup.hasOwnProperty(cityCodeBegin)) {
				const begin = lookup[cityCodeBegin].begin;
				const list = lookup[cityCodeBegin].list;
				const beginGLSL = begin.position.toThreeGLSL();
				for (const cityCodeEnd in list) {
					if (list.hasOwnProperty(cityCodeEnd)) {
						const endPoint = list[cityCodeEnd];
						const pointPGLSL = endPoint.pointP.toThreeGLSL();
						const pointQGLSL = endPoint.pointQ.toThreeGLSL();
						const endGLSL = endPoint.end.position.toThreeGLSL();
						for (const transportName in endPoint.speedRatio) {
							if (endPoint.speedRatio.hasOwnProperty(transportName)) {
								const ratios = endPoint.speedRatio[transportName];
								_curves.push(
									new CurveMeshShader(
										begin.cityCode,
										endPoint.end.cityCode,
										endPoint.theta,
										ratios,
										transportName,
										CONFIGURATION.curvesPosition,
										CONFIGURATION.pointsPerCurve
									)
								);
								pControls0.push(...beginGLSL);
								pControls1.push(...pointPGLSL);
								pControls2.push(...pointQGLSL);
								pControls3.push(...endGLSL);
							}
						}
					}
				}
			}
		}

		_height = _curves.length;
		_heightTab = new Float32Array(_height);
		const options = {
			u_PControls0: { src: new Float32Array(pControls0), width: 1, height: _height },
			u_PControls1: { src: new Float32Array(pControls1), width: 1, height: _height },
			u_PControls2: { src: new Float32Array(pControls2), width: 1, height: _height },
			u_PControls3: { src: new Float32Array(pControls3), width: 1, height: _height },
		};
		_gpgpu.positions.updateTextures(options);
		regenerateStep();
		updateYear();
		computation();
		_ready = true;
		return [..._curves];
	}

	private constructor(
		begin: string | number,
		end: string | number,
		theta: number,
		years: { [year: string]: number },
		transportName: string,
		curvePosition: CURVESPOSITION_ENUM,
		pointsPerCurve: number
	) {
		const interleavedBufferPosition = new InterleavedBuffer(new Float32Array(204 * 4), 4).setUsage(
			DynamicDrawUsage
		);
		const interleavedBufferAttributePosition = new InterleavedBufferAttribute(
			interleavedBufferPosition,
			3,
			0,
			false
		);
		const bufferGeometry = new BufferGeometry();
		bufferGeometry.setAttribute('position', interleavedBufferAttributePosition);
		bufferGeometry.computeBoundingSphere();
		super(bufferGeometry, CONFIGURATION.BASIC_LINE_MATERIAL.clone());
		this._years = years;
		this.theta = theta;
		this.end = end;
		this.begin = begin;
		this.visible = true;
		this._transportName = transportName;
		this._speedRatio = 0;
		this._curvePosition = curvePosition;
		this._pointsPerCurve = pointsPerCurve;
	}

	public get curvesPosition(): CURVESPOSITION_ENUM {
		return this._curvePosition;
	}

	public set curvesPosition(value: CURVESPOSITION_ENUM) {
		this._curvePosition = value;
		updatePosition();
		computation();
	}

	public get pointsPerCurve(): number {
		return this._pointsPerCurve;
	}

	public set pointsPerCurve(value: number) {
		this._pointsPerCurve = value;
		if (value >= 1 && value <= 200) {
			_t = new Float32Array(0);
			regenerateStep();
			computation(this.transportName);
		}
	}

	public static get coefficient(): number {
		return _coefficient;
	}

	// Update edges height when 'coefficient' changes
	// for testing purposes only
	public static set coefficient(value: number) {
		_coefficient = value;
		for (let i = 0; i < _height; i++) {
			const curve = _curves[i];
			_heightTab[i] = getHeight(curve._speedRatio, curve.theta, curve.curvesPosition);
		}

		computation();
	}

	public dispose(): void {
		this.geometry.dispose();
		(<Material>this.material).dispose();
	}

	public get getTheta(): number {
		return this.theta;
	}

	public get transportName(): string {
		return this._transportName;
	}

	public setGeometry(positions: Float32Array): void {
		const bufferedGeometry = <BufferGeometry>this.geometry;
		if (curvesDonTDisplay.includes(this)) {
			bufferedGeometry.setDrawRange(0, 0);
		} else {
			const interleavedBuffer = (<InterleavedBufferAttribute>bufferedGeometry.getAttribute('position')).data;
			interleavedBuffer.set(positions, 0);
			interleavedBuffer.needsUpdate = true;
			bufferedGeometry.computeBoundingSphere();
			bufferedGeometry.setDrawRange(0, _width);
		}
	}

	// Sets the height of edges
	public isAvailable(year: string | number): boolean {
		const speedRatio = this._years[year];
		const result = speedRatio !== undefined;
		if (result) {
			this._speedRatio = speedRatio;
			const index = _curves.indexOf(this);
			const curvePosition = Number(_curves[index].curvesPosition);
			_heightTab[index] = getHeight(this._speedRatio, this.theta, curvePosition);
		}

		return result;
	}
}
