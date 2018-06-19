'use strict';
import {
    BufferGeometry, InterleavedBufferAttribute, BufferAttribute, InterleavedBuffer, Sphere, Line, LineBasicMaterial, DoubleSide,
} from 'three';
import { CONFIGURATION } from '../common/configuration';
import { Cartographic } from '../common/utils';
import { NEDLocal, Coordinate } from '../common/referential';
import { Shaders } from '../shaders';
import { GPUComputer } from '../common/gpuComputer';
import { IEndTownLine, ILookupTransportPerYear, ILookupLine } from '../definitions/project';

let _lines: LineMeshShader[];

let _linesWithoutDisplay: LineMeshShader[] = [];
let uuid: string = undefined;
let _tickCount = 0;
let _ready = false;
let _width: number;
let _height: number;

let _gpgpu: { [x: string]: GPUComputer } = {};

let _t: Float32Array;

function fullCleanArrays(): void {
    _t = new Float32Array(0);
}
fullCleanArrays();

// quand on change step!!
function regenerateStep(): void {
    const step = 1 / CONFIGURATION.pointsPerLine;
    let t: number[] = [];
    for (let i = 0; i < 1; i += step) {
        t.push(i);
    }
    t.push(1);
    _t = new Float32Array(t);
    _width = _t.length;
    let options = {
        u_tSample: { src: _t, width: _width, height: 1 },
    };
    _gpgpu.positions.updateTextures(options);
}

function updateYear(): void {
    let year = CONFIGURATION.year;
    _linesWithoutDisplay = [];
    for (let i = 0; i < _height; i++) {
        if (!_lines[i].isAvailable(year)) {
            _linesWithoutDisplay.push(_lines[i]);
        }
    }
}

function computation(): void {
    let uniforms: { [x: string]: number | ArrayBufferView } = {};
    uniforms.longueurMaxi = CONFIGURATION.extrudedHeight;
    uniforms.threeRadius = CONFIGURATION.THREE_EARTH_RADIUS;
    uniforms.earthRadius = CONFIGURATION.earthRadiusMeters;
    uniforms.referenceEquiRectangular = CONFIGURATION.referenceEquiRectangularArray;
    uniforms.representationInit = CONFIGURATION.projectionInit;
    uniforms.representationEnd = CONFIGURATION.projectionEnd;
    uniforms.percentRepresentation = CONFIGURATION.percentProjection;
    _gpgpu.positions.updateUniforms(uniforms);
    let tempo = _gpgpu.positions.calculate(_width, _height);
    let allPositions = tempo[0];
    let options = {
        points: { src: allPositions, width: _width, height: _height },
    };
    _gpgpu.boundingSphere.updateTextures(options);
    let temp = _gpgpu.boundingSphere.calculate(1, _height);
    let boundingBoxes = temp[0];
    let lastPosition = temp[1];

    let finalPositions = new Float32Array((_width + 1) * _height * 4);
    let offset: number;
    for (let i = 0; i < _height; i++) {
        offset = i * (_width + 1) * 4;
        finalPositions.set(allPositions.subarray(i * _width * 4, (i + 1) * _width * 4), offset);
        finalPositions.set(lastPosition.subarray(i * 4, (i + 1) * 4), offset + 4 * _width);
    }
    let boundingBox: Float32Array;
    for (let i = 0; i < _height; i++) {
        boundingBox = boundingBoxes.subarray(i * 4, (i + 1) * 4);
        _lines[i].setGeometry(finalPositions.subarray(i * (_width + 1) * 4, (i + 1) * (_width + 1) * 4), boundingBox);
    }
}

export class LineMeshShader extends Line {

    private begin: string | number;
    private end: string | number;
    private opening: number;
    private years: ILookupTransportPerYear;

    public static generateCones(lookup: ILookupLine): Promise<LineMeshShader[]> {
        _ready = false;
        _lines = [];
        fullCleanArrays();
        let promise = new Promise((resolve, reject) => {
            if (uuid === undefined) {
                Promise.all([
                    GPUComputer.GPUComputerFactory(
                        Shaders.getShader('lineMeshShader', 'fragment'), {
                            u_tSample: 'R32F',
                            u_PControls0: 'RGB32F',
                            u_PControls1: 'RGB32F',
                            u_PControls2: 'RGB32F',
                            u_PControls3: 'RGB32F',
                        },
                        1).then(
                            (instance) => {
                                _gpgpu.positions = instance;
                                return instance;
                            }),
                    GPUComputer.GPUComputerFactory(
                        Shaders.getShader('boundingSphere', 'fragment'), {
                            points: 'RGBA32F',
                        },
                        2).then(
                            (instance) => {
                                _gpgpu.boundingSphere = instance;
                                return instance;
                            }),
                ]).then(() => {
                    uuid = CONFIGURATION.addEventListener(
                        'heightRatio intrudedHeightRatio  referenceEquiRectangular THREE_EARTH_RADIUS ' +
                        'projectionBegin projectionEnd projectionPercent year pointsPerLine',
                        (name: string, value: any) => {
                            if (_ready === true) {
                                switch (name) {
                                    case 'pointsPerLine':
                                        _t = new Float32Array(0);
                                        regenerateStep();
                                        updateYear();
                                        computation();
                                        break;
                                    case 'year':
                                        updateYear();
                                        computation();
                                        break;
                                    default:
                                        computation();
                                }
                            }
                        });
                    resolve(0);
                });
            } else {
                resolve(0);
            }
        });

        return promise.then(() => {
            let pControls0: number[] = [];
            let pControls1: number[] = [];
            let pControls2: number[] = [];
            let pControls3: number[] = [];
            for (let cityCodeBegin in lookup) {
                if (lookup.hasOwnProperty(cityCodeBegin)) {
                    let begin = lookup[cityCodeBegin].begin;
                    let list = lookup[cityCodeBegin].list;
                    for (let cityCodeEnd in list) {
                        if (list.hasOwnProperty(cityCodeEnd)) {
                            let endPoint = list[cityCodeEnd];
                            _lines.push(new LineMeshShader(begin.cityCode, endPoint.end.cityCode, endPoint.opening, endPoint.years));
                            pControls0.push(...begin.position.toThreeGLSL());
                            pControls1.push(...endPoint.pointP.toThreeGLSL());
                            pControls2.push(...endPoint.pointQ.toThreeGLSL());
                            pControls3.push(...endPoint.end.position.toThreeGLSL());
                        }
                    }
                }
            }
            _height = _lines.length;
            let options = {
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
            return [..._lines];
        });
    }

    public dispose(): void {
        this.geometry.dispose();
        this.material.dispose();
    }

    public setGeometry(positions: Float32Array, boundingSphereData: Float32Array): void {
        let bufferedGeometry = <BufferGeometry>this.geometry;
        if (_linesWithoutDisplay.indexOf(this) === -1) {
            let interleavedBuffer = (<InterleavedBufferAttribute>bufferedGeometry.getAttribute('position')).data;
            interleavedBuffer.set(positions, 0);
            interleavedBuffer.needsUpdate = true;
            let center = bufferedGeometry.boundingSphere.center;
            center.setX(boundingSphereData[0]);
            center.setY(boundingSphereData[1]);
            center.setZ(boundingSphereData[2]);
            bufferedGeometry.boundingSphere.radius = boundingSphereData[3];
            bufferedGeometry.setDrawRange(0, _width);
        } else {
            bufferedGeometry.setDrawRange(0, 0);
        }
    }

    public isAvailable(year: string | number): boolean {
        return this.years[year] !== undefined;
    }

    private constructor(begin: string | number, end: string | number, opening: number, years: ILookupTransportPerYear) {
        const interleavedBufferPosition = new InterleavedBuffer(new Float32Array(204 * 4), 4).setDynamic(true);
        const interleavedBufferAttributePosition = new InterleavedBufferAttribute(interleavedBufferPosition, 3, 0, false);
        const bufferGeometry = new BufferGeometry();
        bufferGeometry.addAttribute('position', interleavedBufferAttributePosition);
        bufferGeometry.computeBoundingSphere();
        bufferGeometry.boundingSphere = new Sphere();
        super(bufferGeometry, CONFIGURATION.BASIC_LINE_MATERIAL.clone());
        this.years = years;
        this.opening = opening;
        this.end = end;
        this.begin = begin;
        this.visible = true;
    }
}
