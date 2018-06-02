'use strict';
importScripts('twgl.js');
import { GPUComputer } from '../common/gpuComputer';
import { CONFIGURATION } from '../common/configuration';
import { NEDLocal, Coordinate } from '../common/referential';
import { Cartographic, matchingBBox, extrapolator, reviver } from '../common/utils';
import { IBBox, ILookupDirection, INEDLocalGLSL } from '../definitions/project';
import { Shaders } from '../shaders';
interface IShaderElevation {
    [year: string]: {
        data: Float32Array,
        absent: number[],
    };
}

class ConeShaderBackWorker {
    private _self: any;
    private _uvsArr: Float32Array;
    private _indexesArr: Uint16Array;
    private _sendIndexMessage: boolean = false;
    private _localLimitsLookup: {
        [x: string]: {
            clock: number,
            distance: number,
        }[],
    };
    private _cityCodeOrder: string[];
    private _ready: boolean = false;
    private width: number;
    private height: number;
    private year: string;
    private gpgpu: {
        [x: string]: GPUComputer,
    } = {};
    private _elevations: IShaderElevation;

    public get ready(): boolean {
        return this._ready;
    }

    public constructor(that: any) {
        this._self = that;
    }

    public regenerateFromConeStep(step: number): void {
        let height = this.height;
        let uvs: number[] = [];
        let clocks: number[] = [];
        let index: number[] = [];
        let x: number,
            y: number,
            ib: number;
        for (let i = 0; i < CONFIGURATION.TWO_PI; i += step) {
            x = Math.cos(i);
            y = Math.sin(i);
            uvs.push(x, y);
            clocks.push(i);
        }
        let length = clocks.length;
        uvs.push(.5, .5, .5, .5);
        clocks.push(-1);
        for (let i = 0; i < length; i++) {
            ib = (i + 1) % length;
            index.push(i, ib, length, i, ib, length + 1);
        }
        let _clocks = new Float32Array(clocks);
        this._uvsArr = new Float32Array(uvs);
        this._indexesArr = new Uint16Array(index);
        this.width = _clocks.length;
        let width = this.width;
        let cacheBoundary: {
            [cityCode: string]: Float32Array,
        } = {};
        for (let cityCode in this._localLimitsLookup) {
            if (this._localLimitsLookup.hasOwnProperty(cityCode)) {
                let localBoundaryFunction = this.localLimitsFunction(this._localLimitsLookup[cityCode], step);
                let tempTab = new Float32Array(width);
                for (let i = 0; i < width; i++) {
                    tempTab[i] = localBoundaryFunction(_clocks[i]);
                }
                cacheBoundary[cityCode] = tempTab;
            }
        }
        let boundaries = new Float32Array(width * height);
        for (let i = 0; i < height; i++) {
            boundaries.set(cacheBoundary[this._cityCodeOrder[i]], i * width);
        }
        let options = {
            u_clocks: {
                src: _clocks,
                width: width,
                height: 1,
            },
            u_boundaryLimits: {
                src: boundaries,
                width: width,
                height: height,
            },
        };
        this.gpgpu.positions.updateTextures(options);
        this._sendIndexMessage = true;
    }

    public updateElevations(year: string): void {
        if (this._elevations.hasOwnProperty(year)) {
            this.year = year;
            let options = {
                u_elevations: {
                    src: this._elevations[year].data,
                    width: 1,
                    height: this.height,
                },
            };
            this.gpgpu.positions.updateTextures(options);
        }
    }

    public updateWithLimits(withLimits: Uint8Array): void {
        let options = {
            u_withLimits: {
                src: withLimits,
                width: 1,
                height: this.height,
            },
        };
        this.gpgpu.positions.updateTextures(options);
    }

    public computation(
        withNormals: boolean,
        uniforms: { [x: string]: number | ArrayBufferView } = {}): void {
        this.gpgpu.positions.updateUniforms(uniforms);
        let height = this.height;
        let width = this.width;
        let allPositions = this.gpgpu.positions.calculate(width, height)[0];
        let options = {
            points: {
                src: allPositions,
                width: width,
                height: height,
            },
        };
        this.gpgpu.boundingSphere.updateTextures(options);
        let temp = this.gpgpu.boundingSphere.calculate(1, height);
        let boundingBoxes = temp[0];
        let lastPosition = temp[1];
        let finalPositions = new Float32Array((width + 1) * height * 4);
        let offset: number;
        for (let i = 0; i < height; i++) {
            offset = i * (width + 1) * 4;
            finalPositions.set(allPositions.subarray(i * width * 4, (i + 1) * width * 4), offset);
            finalPositions.set(lastPosition.subarray(i * 4, (i + 1) * 4), offset + 4 * width);
        }
        let transferables: ArrayBuffer[] = [finalPositions.buffer, boundingBoxes.buffer];
        let message = {
            positions: finalPositions.buffer,
            boundingBoxes: boundingBoxes.buffer,
            disabledCones: this._elevations[this.year].absent,
            width: width + 1,
        };
        if (withNormals === true) {
            let normals: Float32Array;
            options = {
                points: {
                    src: finalPositions,
                    width: width + 1,
                    height: height,
                },
            };
            this.gpgpu.rawNormals.updateTextures(options);
            let raws = this.gpgpu.rawNormals.calculate(width + 1, height)[0];
            options['rawNormals'] = {
                src: raws,
                width: width + 1,
                height: height,
            };
            this.gpgpu.normals.updateTextures(options);
            normals = this.gpgpu.normals.calculate(width + 1, height)[0];
            transferables.push(normals.buffer);
            message['normals'] = normals.buffer;
        }
        if (this._sendIndexMessage === true) {
            message['index'] = this._indexesArr.buffer;
            transferables.push(this._indexesArr.buffer);
            message['uvs'] = this._uvsArr.buffer;
            transferables.push(this._uvsArr.buffer);
            this._sendIndexMessage = false;
        }
        this._self.postMessage({ action: 'cones', data: message }, transferables);
    }

    public initData(
        towns: {
            [cityCode: string]: NEDLocal,
        },
        bboxes: IBBox[],
        cones: { cityCode: string, directions: ILookupDirection }[],
        conestep: number, year: string, limits: Uint8Array,
        uniforms: { [x: string]: number | ArrayBufferView }): void {
        this._ready = false;
        this._localLimitsLookup = {};
        this._cityCodeOrder = [];
        this._elevations = {};
        this.height = cones.length;
        let height = this.height;
        new Promise((resolve, reject) => {
            if (this.gpgpu.positions === undefined) {
                resolve(Promise.all([
                    GPUComputer.GPUComputerFactory(
                        Shaders.getShader('coneMeshShader', 'fragment'),
                        {
                            u_clocks: 'R32F',
                            u_elevations: 'R32F',
                            u_boundaryLimits: 'R32F',
                            u_summits: 'RGB32F',
                            u_ned2ECEF0s: 'RGB32F',
                            u_ned2ECEF1s: 'RGB32F',
                            u_ned2ECEF2s: 'RGB32F',
                            u_withLimits: 'R8',
                        },
                        1).then((instance) => {
                            this.gpgpu.positions = instance;
                            return instance;
                        }),
                    GPUComputer.GPUComputerFactory(
                        Shaders.getShader('rawVerticeNormal', 'fragment'), {
                            points: 'RGBA32F',
                        },
                        1).then((instance) => {
                            this.gpgpu.rawNormals = instance;
                            return instance;
                        }),
                    GPUComputer.GPUComputerFactory(
                        Shaders.getShader('verticeNormal', 'fragment'), {
                            points: 'RGBA32F',
                        },
                        1).then((instance) => {
                            this.gpgpu.normals = instance;
                            return instance;
                        }),
                    GPUComputer.GPUComputerFactory(
                        Shaders.getShader('boundingSphere', 'fragment'), {
                            points: 'RGBA32F',
                        },
                        2).then((instance) => {
                            this.gpgpu.boundingSphere = instance;
                            return instance;
                        }),
                ]));
            } else {
                resolve(0);
            }
        }).then(() => {
            let summits: number[] = [];
            let ned2ECEF0: number[] = [];
            let ned2ECEF1: number[] = [];
            let ned2ECEF2: number[] = [];
            let lookupReferential: {
                [cityCode: string]: INEDLocalGLSL,
            } = {};
            let position: Cartographic;
            for (let cityCode in towns) {
                if (towns.hasOwnProperty(cityCode)) {
                    lookupReferential[cityCode] = towns[cityCode].ned2ECEFMatrix;
                    this._localLimitsLookup[cityCode] =
                        this.localLimitsRaw(matchingBBox(towns[cityCode].cartoRef, bboxes), towns[cityCode]);
                }
            }
            let yearList: string[] = [];
            for (let i = 0; i < height; i++) {
                let cityCode = cones[i].cityCode;
                let referentialGLSL = lookupReferential[cityCode];
                this._cityCodeOrder.push(cityCode);
                summits.push(...referentialGLSL.summit);
                ned2ECEF0.push(...referentialGLSL.ned2ECEF0);
                ned2ECEF1.push(...referentialGLSL.ned2ECEF1);
                ned2ECEF2.push(...referentialGLSL.ned2ECEF2);
                yearList.push(...Object.keys(cones[i].directions));
            }
            let yearSet = new Set(yearList);
            for (let i = 0; i < height; i++) {
                let directions = cones[i].directions;
                yearSet.forEach((y) => {
                    if (this._elevations[y] === undefined) {
                        this._elevations[y] = {
                            data: new Float32Array(height),
                            absent: [],
                        };
                    }
                    let elevations = this._elevations[y];
                    if (Array.isArray(directions[y]) && directions[y].length > 0) {
                        elevations.data[i] = directions[y][0].elevation;
                    } else {
                        elevations.absent.push(i);
                    }
                });
            }
            let options = {
                u_summits: {
                    src: new Float32Array(summits),
                    width: 1,
                    height: height,
                },
                u_ned2ECEF0s: {
                    src: new Float32Array(ned2ECEF0),
                    width: 1,
                    height: height,
                },
                u_ned2ECEF1s: {
                    src: new Float32Array(ned2ECEF1),
                    width: 1,
                    height: height,
                },
                u_ned2ECEF2s: {
                    src: new Float32Array(ned2ECEF2),
                    width: 1,
                    height: height,
                },
            };
            this.gpgpu.positions.updateTextures(options);
            this.regenerateFromConeStep(conestep);
            this.updateElevations(year);
            this.updateWithLimits(limits);
            this.computation(true, uniforms);
            this._ready = true;
        });
    }

    private localLimitsFunction(
        tab: {
            clock: number,
            distance: number,
        }[],
        coneStep: number): (x: number) => number {
        let clockDistance = tab.reduce(
            (result, current) => {
                let clockClass = Math.floor(current.clock / coneStep) * coneStep;
                result[clockClass] = result[clockClass] === undefined
                    ? current.distance
                    : Math.min(result[clockClass], current.distance);
                return result;
            },
            {});
        let temporaire: {
            clock: number,
            distance: number,
        }[] = [];
        for (let clockString in clockDistance) {
            if (clockDistance.hasOwnProperty(clockString)) {
                temporaire.push({ clock: parseFloat(clockString), distance: clockDistance[clockString] });
            }
        }
        return extrapolator(temporaire, 'clock', 'distance');
    }

    private localLimitsRaw(boundaries: Cartographic[][], referential: NEDLocal): {
        clock: number,
        distance: number,
    }[] {
        let allPoints: Coordinate[] = [];
        boundaries.forEach((boundary) => {
            boundary.forEach((position) => {
                allPoints.push(referential.cartographic2NED(position));
            });
        });
        let resultat: {
            clock: number,
            distance: number,
        }[] = [];
        allPoints.forEach(
            (pos) => {
                let clook = Math.atan2(pos.y, pos.x);
                let distance = Math.sqrt(pos.x * pos.x + pos.y * pos.y + pos.z * pos.z);
                resultat.push(
                    {
                        clock: clook,
                        distance: distance,
                    },
                    {
                        clock: clook + CONFIGURATION.TWO_PI,
                        distance: distance,
                    },
                    {
                        clock: clook - CONFIGURATION.TWO_PI,
                        distance: distance,
                    });
            });
        resultat.sort((a, b) => a.clock - b.clock);
        return resultat;
    }
}

let worker: ConeShaderBackWorker;
self.addEventListener('message', (event) => {
    'use strict';
    if (worker === undefined) {
        worker = new ConeShaderBackWorker(<any>self);
    }
    let datas = event.data.data;
    let action = event.data.action;
    if (action === 'init') {
        let towns = <{ [cityCode: string]: NEDLocal }>JSON.parse(datas.towns, reviver);
        let bboxes = <IBBox[]>JSON.parse(datas.bboxes, reviver);
        worker.initData(
            towns,
            bboxes,
            datas.cones,
            datas.conestep,
            datas.year,
            datas.limits,
            datas.uniforms,
        );
    } else if (worker.ready === true) {
        // arraybuffer limits and some of uniforms
        if (datas.conestep !== undefined) {
            worker.regenerateFromConeStep(datas.conestep);
        }
        if (datas.year !== undefined) {
            worker.updateElevations(datas.year);
        }
        if (datas.limits !== undefined) {
            let limits = datas.limits;
            worker.updateWithLimits(limits);
        }
        if (action === 'coneStep' || action === 'year' ||
            action === 'limits' || action === 'projectionBegin') {
            worker.computation(true, datas.uniforms);
        } else {
            worker.computation(false, datas.uniforms);
        }
    } else {
        (<any>self).postMessage({ action: 'information', data: 'not ready' });
    }

});
