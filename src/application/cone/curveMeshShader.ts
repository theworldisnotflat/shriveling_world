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
let _nbCurves: number;
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
 * * '[[speedAMB]]' is computed in function '[[getModelledSpeed]]' in file [[bigBoard/merger.ts]]
 * * '[[OMPrime]]' is computed with [two formulas](https://timespace.hypotheses.org/121)
 * depending on '[[theta]]' compared with '[[thetaThreshold]]'
 *
 * * below [[thetaThreshold]]: ![below](http://bit.ly/2Xu3kGF)
 * * beyond [[thetaThreshold]]: ![beyond](http://bit.ly/2EejFpW)
 * * the figure: ![2](http://bit.ly/2H4FOKw)
 *
 * @param speedAMB
 * @param theta
 */
function getCurveHeight(
	speedAMB: number,
	maxSpeed: number,
	theta: number,
	curvesPosition: CURVESPOSITION_ENUM
): number {
	const semiTheta = theta / 2;
	const sinSemiTheta = Math.sin(semiTheta);
	const cosSemiTheta = Math.cos(semiTheta);
	const ratio = (maxSpeed * theta) / (2 * speedAMB);
	const secondTerm = Math.sqrt(ratio * ratio - sinSemiTheta * sinSemiTheta);
	// The equation (2) of length om'
	const OMPrime = (cosSemiTheta + secondTerm) * CONFIGURATION.earthRadiusMeters * _coefficient;
	// Minus earth radius to compute cm', the curve height
	switch (curvesPosition) {
		case 0: // above the surface of the earth
			return OMPrime - CONFIGURATION.earthRadiusMeters; // Minus earth radius to compute cm'
		case 1: // below
			return -(OMPrime - CONFIGURATION.earthRadiusMeters);
		case 2: // TODO
			return -(OMPrime - CONFIGURATION.earthRadiusMeters);
		case 3: // TODO
			return -(OMPrime - CONFIGURATION.earthRadiusMeters);
	}
}

/**
 * Step is the number of facets forming the cones, default value is 15
 *
 * higher values will consume processor load
 */
function regenerateCurvesGeometry(): void {
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
 * * Update curves geometry and remove curves from view
 * if [[computeCurveHeightAndTestIfAvailable]] based on
 * the reference [[year]]
 * * Function [[computeCurveHeightAndTestIfAvailable]] will
 * also compute curves height
 */
function updateCurvesYear(): void {
	const year = CONFIGURATION.year;
	curvesDonTDisplay = [];
	for (let i = 0; i < _nbCurves; i++) {
		if (!_curves[i].computeCurveHeight(year)) {
			curvesDonTDisplay.push(_curves[i]);
		}
	}
}

function computation(transName?: any): void {
	const uniforms: { [x: string]: number | ArrayBufferView } = {};
	uniforms.longueurMaxi = CONFIGURATION.extrudedHeight;
	uniforms.threeRadius = CONFIGURATION.THREE_EARTH_RADIUS;
	uniforms.earthRadius = CONFIGURATION.earthRadiusMeters;
	uniforms.referenceEquiRectangular = CONFIGURATION.referenceEquiRectangularArray;
	uniforms.projectionInit = CONFIGURATION.projectionInit;
	uniforms.projectionEnd = CONFIGURATION.projectionEnd;
	uniforms.percentProjection = CONFIGURATION.percentProjection;
	uniforms.conesShape = CONFIGURATION.conesShape;
	uniforms.standardParallel1 = CONFIGURATION.standardParallel1;
	uniforms.standardParallel2 = CONFIGURATION.standardParallel2;
	uniforms.coefficient = _coefficient;
	uniforms.zCoeff = CONFIGURATION.zCoeff;
	_gpgpu.positions.updateUniforms(uniforms);
	const options = {
		u_height: { src: _heightTab, width: 1, height: _nbCurves },
	};
	_gpgpu.positions.updateTextures(options);
	const tempo = _gpgpu.positions.calculate(_width, _nbCurves);
	const allPositions = tempo[0];
	for (let i = 0; i < _nbCurves; i++) {
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
	private readonly _speedPerYear: { [year: string]: number };
	private readonly _maxSpeedPerYear: { [year: string]: number };
	private readonly _transportName: string;
	private _speedAMB: number;
	private _maxSpeed: number;
	private _curvePosition: CURVESPOSITION_ENUM;
	private _pointsPerCurve: number;

	public static async generateCurves(lookup: ILookupCurves): Promise<CurveMeshShader[]> {
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
										updateCurvesYear();
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
				const begin = lookup[cityCodeBegin].beginCity;
				const _curveList = lookup[cityCodeBegin].curvesList;
				const beginGLSL = begin.position.toThreeGLSL();
				for (const cityCodeEnd in _curveList) {
					if (_curveList.hasOwnProperty(cityCodeEnd)) {
						const _curve = _curveList[cityCodeEnd];
						const pointPGLSL = _curve.pointP.toThreeGLSL();
						const pointQGLSL = _curve.pointQ.toThreeGLSL();
						const endGLSL = _curve.endCity.position.toThreeGLSL();
						for (const transportName in _curve.speedPerModePerYear) {
							if (_curve.speedPerModePerYear.hasOwnProperty(transportName)) {
								const _speedPerYear = _curve.speedPerModePerYear[transportName];
								const _maxSpeedPerYear = _curve.maxSpeedPerYear;
								_curves.push(
									new CurveMeshShader(
										begin.cityCode,
										_curve.endCity.cityCode,
										_curve.theta,
										_speedPerYear,
										_maxSpeedPerYear,
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

		_nbCurves = _curves.length;
		_heightTab = new Float32Array(_nbCurves);
		const options = {
			u_PControls0: { src: new Float32Array(pControls0), width: 1, height: _nbCurves },
			u_PControls1: { src: new Float32Array(pControls1), width: 1, height: _nbCurves },
			u_PControls2: { src: new Float32Array(pControls2), width: 1, height: _nbCurves },
			u_PControls3: { src: new Float32Array(pControls3), width: 1, height: _nbCurves },
		};
		_gpgpu.positions.updateTextures(options);
		regenerateCurvesGeometry();
		updateCurvesYear();
		computation();
		_ready = true;
		return [..._curves];
	}

	private constructor(
		begin: string | number,
		end: string | number,
		theta: number,
		speedPerYear: { [year: string]: number },
		maxSpeedPerYear: { [year: string]: number },
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
		this._speedPerYear = speedPerYear;
		this._maxSpeedPerYear = maxSpeedPerYear;
		this.theta = theta;
		this.end = end;
		this.begin = begin;
		this.visible = true;
		this._transportName = transportName;
		this._speedAMB = 0;
		this._maxSpeed = 0;
		this._curvePosition = curvePosition;
		this._pointsPerCurve = pointsPerCurve;
	}

	public get curvePosition(): CURVESPOSITION_ENUM {
		return this._curvePosition;
	}

	public set curvePosition(value: CURVESPOSITION_ENUM) {
		this._curvePosition = value;
		updateCurvesYear();
		computation();
	}

	public get pointsPerCurve(): number {
		return this._pointsPerCurve;
	}

	public set pointsPerCurve(value: number) {
		this._pointsPerCurve = value;
		if (value >= 1 && value <= 200) {
			_t = new Float32Array(0);
			regenerateCurvesGeometry();
			computation(this.transportName);
		}
	}

	public static get coefficient(): number {
		return _coefficient;
	}

	/**
	 * Update edges height when 'coefficient' changes
	 * for testing purposes only
	 */
	public static set coefficient(value: number) {
		_coefficient = value;
		for (let i = 0; i < _nbCurves; i++) {
			const curve = _curves[i];
			_heightTab[i] = getCurveHeight(curve._speedAMB, curve._maxSpeed, curve.theta, curve.curvePosition);
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

	/**
	 * Sets the height of edges:
	 * for the given [year] will retrieve the
	 * speeds to be considered in figure: ![2](http://bit.ly/2H4FOKw)
	 */
	public computeCurveHeight(year: string | number): boolean {
		const speedAMB = this._speedPerYear[year];
		const maxSpeed = this._maxSpeedPerYear[year];
		const speedIsUndefined = speedAMB !== undefined; // if speedAMB is undefined, the curve shouldn't be displayed
		if (speedIsUndefined) {
			this._speedAMB = speedAMB;
			this._maxSpeed = maxSpeed;
			const index = _curves.indexOf(this);
			const curvePosition = Number(_curves[index].curvePosition);
			_heightTab[index] = getCurveHeight(this._speedAMB, this._maxSpeed, this.theta, curvePosition);
			// uncomment to display in console the edge data:
			// const halfGeodesicLength = (this.theta * CONFIGURATION.earthRadiusMeters) / 2;
			// const OM = _heightTab[index];
			// const curveLength = 2 * Math.sqrt(halfGeodesicLength * halfGeodesicLength + OM * OM); //neglecting earth curvature (sorry!)
			// const graphicalRatio = (2 * halfGeodesicLength) / curveLength;
			// console.log(
			// 	'maxSpeed',
			// 	this._maxSpeed,
			// 	'speedAMB',
			// 	this._speedAMB,
			// 	this._transportName,
			// 	this.begin,
			// 	this.end,'graphicalRatio',
			// 	graphicalRatio
			// );
		}

		return speedIsUndefined;
	}
}
