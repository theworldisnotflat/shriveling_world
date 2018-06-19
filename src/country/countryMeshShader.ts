'use strict';
import { Point, SweepContext, IPointLike } from 'poly2tri';
import {
    Vector2, Face3, Vector3, Mesh, InterleavedBuffer, InterleavedBufferAttribute, BufferGeometry,
    BufferAttribute, Sphere,
} from 'three';
import { CONFIGURATION } from '../common/configuration';
import { Cartographic, mapProjectors } from '../common/utils';
import { IBBox, ITypeExtrusion, IMarkLimits } from '../definitions/project';
import { GPUComputer } from '../common/gpuComputer';
import { Shaders } from '../shaders';

interface IPreGeometry {
    vertice: number[]; // cartographic.toThreeGLSL()
    extruded: IMarkLimits; // position des extruded dans la propriété vertice
    uvs: Float32Array; // uvs des vertices
    indexes: Uint16Array; // index des vertices!!
    surfaceBoundary: Cartographic[];
}
interface IPreMesh {
    geometry: IPreGeometry;
    properties: any;
}

let _vertexArrayEntries: Float32Array;
let _countries: CountryMeshShader[];
let uuid: string = undefined;
let _dirty = false;
let _tickCount = 0;
let _ready = false;
let _width: number;
let _height: number = 1;

let _gpgpu: { [x: string]: GPUComputer } = {};

function fullCleanArrays(): void {
    _vertexArrayEntries = new Float32Array(0);
    _countries = [];
}
fullCleanArrays();

function cnPnPolyIsIn(P: number[], V: number[][]): boolean {
    let cn = 0;    // the  crossing number counter
    let iplus: number, n = V.length;
    // loop through all edges of the polygon
    for (let i = 0; i < n; i++) {    // edge from V[i]  to V[i+1]
        iplus = (i === n - 1) ? 0 : i + 1;
        if (((V[i][1] <= P[1]) && (V[iplus][1] > P[1]))
            || ((V[i][1] > P[1]) && (V[iplus][1] <= P[1]))) {
            let vt = (P[1] - V[i][1]) / (V[iplus][1] - V[i][1]);
            if (P[0] < V[i][0] + vt * (V[iplus][0] - V[i][0])) {
                cn++;
            }
        }
    }
    return cn % 2 === 1;    // 0 if even (out), and 1 if  odd (in)
}

function generateSteinerPointsFor(poly: number[][]): Point[] {
    let resultat: Point[] = [];
    if (poly.length > 2) {
        const discriminant = 3;
        let minx = 1e23, maxx = -1e23;
        let miny = 1e23, maxy = -1e23;

        let i: number;
        for (i = 0; i < poly.length; i++) {
            let p = poly[i];
            minx = Math.min(minx, p[0]); miny = Math.min(miny, p[1]);
            maxx = Math.max(maxx, p[0]); maxy = Math.max(maxy, p[1]);
        }
        let temp: number[], fx: number, fy: number;
        for (let x = minx; x < maxx; x += discriminant) {
            for (let y = miny; y < maxy; y += discriminant) {
                fx = x + (0.5 - Math.random()) / 2 * discriminant;
                fy = y + (0.5 - Math.random()) / 2 * discriminant;
                temp = [fx, fy];
                if (cnPnPolyIsIn(temp, poly)) {
                    resultat.push(new Point(fx, fy));
                }
            }

        }
    }
    return resultat;
}

function cleanBoundaries(polygon: number[][]): number[][] {
    let i: number, done = false, p, q, o, a, b, dx, dy, d, n, xj, yj, j;
    while (!done) {
        done = true;
        // remove duplicates
        for (i = 0; i < polygon.length; i++) {
            p = polygon[i];
            q = polygon[(i + 1) % polygon.length];
            if (Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) < 1e-5) {
                polygon.splice(i, 1);
                i = Math.max(-1, i - 2);
                done = false;
            }
        }
        // remove collinear edges
        for (i = 0; i < polygon.length; i++) {
            o = polygon[(i - 1 + polygon.length) % polygon.length];
            p = polygon[i];
            q = polygon[(i + 1) % polygon.length];
            a = { x: o[0] - p[0], y: o[1] - p[1] };
            b = { x: q[0] - p[0], y: q[1] - p[1] };
            if (Math.abs(
                (a.x * b.x + a.y * b.y) /
                Math.sqrt((a.x * a.x + a.y * a.y) * (b.x * b.x + b.y * b.y))) > 1 - 1e-5) {
                polygon.splice(i, 1);
                i = Math.max(-1, i - 2);
                done = false;
            }
        }
    }
    for (i = 0; i < polygon.length; 0) {
        p = polygon[i];
        q = polygon[(i + 1) % polygon.length];
        dx = q[0] - p[0];
        dy = q[1] - p[1];
        d = Math.sqrt(dx * dx + dy * dy);
        n = Math.ceil(d / 7); // one point every ~7°
        for (j = 1; j < n; j++) {
            // we add orthogonal vector at every 2nd point to create non-collinear edges
            xj = p[0] + dx * j / n - dy * (j % 2) * 1e-6;
            yj = p[1] + dy * j / n + dx * (j % 2) * 1e-6;
            polygon.splice(i + j, 0, [xj, yj]);
        }
        i += n;
    }

    // there can stll be zero-area triangles between poly and hole
    // this attempts to reduce the probability of such a situation
    for (i = 0; i < polygon.length; i++) {
        polygon[i][0] += 1e-9 * Math.random();
        polygon[i][1] += 1e-9 * Math.random();
    }

    return polygon;
}

function generateVertices(geometry: GeoJSON.MultiPolygon | GeoJSON.Polygon): IPreGeometry[] {
    let coordinates: number[][][][];
    switch (geometry.type) {
        case 'Polygon':
            coordinates = [geometry.coordinates];
            break;
        case 'MultiPolygon':
            coordinates = geometry.coordinates;
            break;
        default:
            coordinates = [[[[]]]];
    }
    return coordinates.map((polygonWithHoles) => {
        let steinerPoints: Point[];
        let holes: Point[][] = [];
        let contour: Point[];
        polygonWithHoles = polygonWithHoles.map((polygon, index) => {
            let cleanedBoundaries = cleanBoundaries(polygon);
            if (index === 0) {
                steinerPoints = generateSteinerPointsFor(cleanedBoundaries);
                contour = cleanedBoundaries.map((item) => new Point(item[0], item[1]));
            } else {
                holes.push(cleanedBoundaries.map((item) => new Point(item[0], item[1])));
            }
            return cleanedBoundaries;
        });

        let swctx = new SweepContext(contour);
        swctx.addHoles(holes);
        swctx.addPoints(steinerPoints);
        swctx.triangulate();
        let triangles = swctx.getTriangles();

        let verticesPoly2Tri: IPointLike[] = [];

        function findAndAddVertexIndex(p: IPointLike): number {
            let vs = verticesPoly2Tri;
            let out = -1;
            for (let k = 0; k < vs.length; k++) {
                if (Math.abs(vs[k].x - p.x) + Math.abs(vs[k].y - p.y) < 1e-5) {
                    out = k;
                }
            }
            if (out === -1) {
                vs.push(p);
                out = vs.length - 1;
            }
            return out;
        }

        let indexes: number[] = [];
        triangles.forEach(triangle => indexes.push(...triangle.getPoints().map(findAndAddVertexIndex)));
        // index n'a que la surface inférieure!
        let vertice = verticesPoly2Tri.map((v) => new Cartographic(v.x, v.y, 0, false));
        // vertices n'a que la surface inférieure!
        let uvs: number[] = [];
        vertice.forEach(vertex => uvs.push(
            vertex.longitude * CONFIGURATION.OVER_TWO_PI + 0.5,
            vertex.latitude * CONFIGURATION.OVER_PI + 0.5));

        let verticePerSurfaceCount = vertice.length;
        let indexesPerSurfaceCount = indexes.length;
        // peuplement de la seconde surface
        for (let i = 0; i < verticePerSurfaceCount; i++) {
            let carto = vertice[i].clone();
            carto.height = CONFIGURATION.hatHeight;
            vertice.push(carto);
            uvs.push(
                carto.longitude * CONFIGURATION.OVER_TWO_PI + 0.5,
                carto.latitude * CONFIGURATION.OVER_PI + 0.5);
        }
        let lateralIndexes: number[] = [];
        let ia: number, ib: number, ian: number, ibn: number;
        for (let i = 0; i < indexesPerSurfaceCount; i += 3) {
            indexes.push(
                indexes[i] + verticePerSurfaceCount,
                indexes[i + 1] + verticePerSurfaceCount,
                indexes[i + 2] + verticePerSurfaceCount);
            // triangles latéraux!
            for (let j = 0; j < 3; j++) {
                ia = indexes[i + j]; ib = indexes[i + ((j + 1) % 3)];
                ian = indexes[i + j + indexesPerSurfaceCount]; ibn = indexes[i + ((j + 1) % 3) + indexesPerSurfaceCount];
                lateralIndexes.push(ia, ib, ian, ib, ibn, ian);
            }
        }
        for (let i = 0; i < lateralIndexes.length; i++) {
            indexes.push(lateralIndexes[i]);
        }
        let tempVertice: number[] = [];
        vertice.forEach(vertex => tempVertice.push(...vertex.toThreeGLSL()));
        let resultat: IPreGeometry = {
            vertice: tempVertice,
            extruded: {
                begin: verticePerSurfaceCount * 3,
                end: verticePerSurfaceCount * 6,
            },
            uvs: new Float32Array(uvs),
            indexes: new Uint16Array(indexes),
            surfaceBoundary: contour.map((point) => new Cartographic(point.x, point.y, 0, false)),
        };
        return resultat;
    });
}

function uniqueOccurenceCounter(list: any[]): string {
    let dictionnary = {};
    list.forEach(item => {
        for (let att in item) {
            if (item.hasOwnProperty(att)) {
                if (!dictionnary.hasOwnProperty(att)) {
                    dictionnary[att] = [];
                }
                if (dictionnary[att].indexOf(item[att]) === -1) {
                    dictionnary[att].push(item[att]);
                }
            }
        }
    });
    return Object.keys(dictionnary).sort((a, b) => dictionnary[b].length - dictionnary[a].length)[0];
}

function maxRectangle(n: number): number[] {
    let primes: number[] = [], width = 1, height = 1, i = 0;
    if (n >= 2) {
        for (let i = 2; i <= n; i++) {
            while (n % i === 0) {
                primes.push(i);
                n /= i;
            }
        }
    } else {
        return [n, 1];
    }
    console.log(primes);
    while (primes.length > 0 && width <= 8192) {
        width *= primes.shift();
        break;
    }
    for (i = 0; i < primes.length; i++) {
        if (primes[i] * width <= 8192) {
            width *= primes[i];
        } else {
            break;
        }
    }
    for (; i < primes.length; i++) {
        height *= primes[i];
    }

    return width === height && height === 1 ? [n, 1] : [width, height];
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
    let options: { [x: string]: { src: ArrayBufferView, width: number, height: number, depth?: number } } = {
        u_Positions: { src: _vertexArrayEntries, width: _width, height: _height },
    };
    _gpgpu.positions.updateTextures(options);
    let allPositions = _gpgpu.positions.calculate(_width, _height)[0];
    let norms: Float32Array;
    let country: CountryMeshShader;
    let begin: number, end: number;
    for (let i = 0; i < _countries.length; i++) {
        country = _countries[i];
        begin = country.outputLimits.begin;
        end = country.outputLimits.end;
        country.setGeometry(allPositions.subarray(begin, end));
    }
}

export class CountryMeshShader extends Mesh {
    public otherProperties: any;
    public outputLimits: IMarkLimits;
    private _boundaryBox: IBBox;
    private _extrudedLimits: IMarkLimits;
    private _extrudedPercent: number;
    private _mainProperty: string;

    public static generator(geoJson: GeoJSON.FeatureCollection): Promise<CountryMeshShader[]> {
        _ready = false;
        _countries = [];
        fullCleanArrays();
        let promise = new Promise((resolve) => {
            if (uuid === undefined) {
                Promise.all([
                    GPUComputer.GPUComputerFactory(
                        Shaders.getShader('countryMeshShader', 'fragment'), {
                            u_Positions: 'RGB32F', // _vertexArrayEntries
                        },
                        1).then(
                            (instance) => {
                                _gpgpu.positions = instance;
                                return instance;
                            }),
                ]).then(() => {
                    uuid = CONFIGURATION.addEventListener(
                        'heightRatio intrudedHeightRatio referenceEquiRectangular THREE_EARTH_RADIUS ' +
                        'projectionBegin projectionEnd projectionPercent tick',
                        (name: string, value: any) => {
                            if (_ready === true) {
                                switch (name) {
                                    case 'tick':
                                        if (_dirty === true && _tickCount > 10) {
                                            let options = {
                                                u_Positions: { src: _vertexArrayEntries, width: _width, height: _height },
                                            };
                                            _gpgpu.positions.updateTextures(options);
                                            computation();
                                            _tickCount = 0;
                                            _dirty = false;
                                        } else {
                                            _tickCount++;
                                        }
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
            if (geoJson.type === 'FeatureCollection') {
                fullCleanArrays();
                let preMeshes: IPreMesh[] = [];
                let uniqueProperties: any[] = [];
                geoJson.features.forEach((feature) => {
                    let properties = feature.properties;
                    uniqueProperties.push(properties);
                    generateVertices(<GeoJSON.MultiPolygon | GeoJSON.Polygon>feature.geometry)
                        .forEach(item => preMeshes.push({ geometry: item, properties: properties }));
                });
                let mainProperty = uniqueOccurenceCounter(uniqueProperties);
                let indexCount = 0, oldIndexCount = 0;
                let vertexArrayEntries: number[] = [];
                for (let i = 0; i < preMeshes.length; i++) {
                    let item = preMeshes[i];
                    oldIndexCount = indexCount;
                    indexCount += item.geometry.vertice.length / 3;
                    vertexArrayEntries.push(...item.geometry.vertice);
                    let extruded = item.geometry.extruded;
                    extruded.begin += oldIndexCount * 3;
                    extruded.end += oldIndexCount * 3;
                    let outputLimits = { begin: oldIndexCount * 4, end: indexCount * 4 };
                    _countries.push(new CountryMeshShader(item, mainProperty, outputLimits));
                }
                [_width, _height] = maxRectangle(vertexArrayEntries.length / 3);
                _vertexArrayEntries = new Float32Array(vertexArrayEntries);
                console.log(_vertexArrayEntries.length, [_width, _height]);
                computation();
            } else {
                throw new Error('not a geoJson');
            }
            _ready = true;
            return [..._countries];
        });
    }

    public get bbox(): IBBox {
        return this._boundaryBox;
    }
    public get extruded(): number {
        return this._extrudedPercent;
    }
    public set extruded(value: number) {
        let abs = Math.abs(value);
        if (abs > 0.0001 && abs <= 100) {
            this._extrudedPercent = value;
            let outValue = value * CONFIGURATION.extrudedHeight / 100;
            let begin = this._extrudedLimits.begin;
            let end = this._extrudedLimits.end;
            for (let i = begin; i < end; i += 3) {
                _vertexArrayEntries[i + 2] = outValue;
            }
            _dirty = true;
        }
    }

    public get mainName(): string {
        return this._mainProperty;
    }

    public isInside(pos: Cartographic): boolean {
        let resultat = false;
        if (pos.latitude >= this._boundaryBox.minLat && pos.latitude <= this._boundaryBox.maxLat &&
            pos.longitude >= this._boundaryBox.minLong && pos.longitude <= this._boundaryBox.maxLong) {
            resultat = Cartographic.isInside(pos, this._boundaryBox.boundary);
        }
        return resultat;
    }

    public setGeometry(positions: Float32Array): void {
        let bufferedGeometry = <BufferGeometry>this.geometry;
        let interleavedBuffer = (<InterleavedBufferAttribute>bufferedGeometry.getAttribute('position')).data;
        interleavedBuffer.set(positions, 0);
        interleavedBuffer.needsUpdate = true;
        bufferedGeometry.computeBoundingSphere();
    }

    private constructor(preMesh: IPreMesh, mainProperty: string, outputLimits: IMarkLimits) {
        let positionDelta = outputLimits.end - outputLimits.begin;
        const interleavedBufferPosition = new InterleavedBuffer(new Float32Array(positionDelta), 4).setDynamic(true);
        const interleavedBufferAttributePosition = new InterleavedBufferAttribute(interleavedBufferPosition, 3, 0, false);
        const interleavedBufferNormal = new InterleavedBuffer(new Float32Array(positionDelta), 4).setDynamic(true);
        const interleavedBufferAttributeNormal = new InterleavedBufferAttribute(interleavedBufferNormal, 3, 0, false);
        const bufferGeometry = new BufferGeometry();
        let preGeometry = preMesh.geometry;
        bufferGeometry.addAttribute('position', interleavedBufferAttributePosition);
        bufferGeometry.addAttribute('normal', interleavedBufferAttributeNormal);
        bufferGeometry.addAttribute('uv', new BufferAttribute(preGeometry.uvs, 2));
        bufferGeometry.setIndex(new BufferAttribute(preGeometry.indexes, 1));
        bufferGeometry.setDrawRange(0, preGeometry.indexes.length);
        bufferGeometry.computeBoundingSphere();
        bufferGeometry.boundingSphere = new Sphere();
        super(bufferGeometry, CONFIGURATION.COUNTRY_MATERIAL.clone());
        this.otherProperties = preMesh.properties;
        this._boundaryBox = { minLat: 1000, minLong: 1000, maxLat: -1000, maxLong: -1000, boundary: preGeometry.surfaceBoundary };
        for (let i = 0; i < this._boundaryBox.boundary.length; i++) {
            let pos = this._boundaryBox.boundary[i];
            this._boundaryBox.minLong = Math.min(this._boundaryBox.minLong, pos.longitude);
            this._boundaryBox.minLat = Math.min(this._boundaryBox.minLat, pos.latitude);
            this._boundaryBox.maxLong = Math.max(this._boundaryBox.maxLong, pos.longitude);
            this._boundaryBox.maxLat = Math.max(this._boundaryBox.maxLat, pos.latitude);
        }
        this._extrudedLimits = preGeometry.extruded;
        this.outputLimits = outputLimits;
        this._mainProperty = preMesh.properties[mainProperty];
        this.extruded = 1;
    }
}
