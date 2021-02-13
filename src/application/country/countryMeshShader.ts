'use strict';
import { Point, SweepContext, IPointLike } from 'poly2tri';
import {
	Mesh,
	InterleavedBuffer,
	InterleavedBufferAttribute,
	BufferGeometry,
	BufferAttribute,
	DynamicDrawUsage,
} from 'three';
import { CONFIGURATION } from '../common/configuration';
import { Cartographic } from '../common/utils';
import type { IBBox, IMarkLimits } from '../definitions/project';
import { GPUComputer } from '../common/gpuComputer';
import { getShader } from '../shaders';
import type * as GeoJSON from 'geojson';

interface IPreGeometry {
	vertices: number[]; // Cartographic.toThreeGLSL()
	extruded: IMarkLimits; // Position des extruded dans la propriété vertices
	uvs: Float32Array; // Uvs des vertices
	indexes: Uint16Array; // Index des vertices!!
	surfaceBoundary: Cartographic[];
}
interface IPreMesh {
	geometry: IPreGeometry;
	properties: any;
}

let _vertexArrayEntries: Float32Array;
let _countries: CountryMeshShader[];
let uuid: string;
let _dirty = false;
let _tickCount = 0;
let _ready = false;
let _width: number;
let _height = 1;

const _gpgpu: { [x: string]: GPUComputer } = {};

function fullCleanArrays(): void {
	_vertexArrayEntries = new Float32Array(0);
	_countries = [];
}

fullCleanArrays();

function cnPnPolyIsIn(P: number[], V: number[][]): boolean {
	let cn = 0; // The  crossing number counter
	let iPlus: number;
	const n = V.length;
	// Loop through all edges of the polygon
	for (let i = 0; i < n; i++) {
		// Edge from V[i]  to V[i+1]
		iPlus = i === n - 1 ? 0 : i + 1;
		if ((V[i][1] <= P[1] && V[iPlus][1] > P[1]) || (V[i][1] > P[1] && V[iPlus][1] <= P[1])) {
			const vt = (P[1] - V[i][1]) / (V[iPlus][1] - V[i][1]);
			if (P[0] < V[i][0] + vt * (V[iPlus][0] - V[i][0])) {
				cn++;
			}
		}
	}

	return cn % 2 === 1; // 0 if even (out), and 1 if  odd (in)
}

function generateSteinerPointsFor(poly: number[][]): Point[] {
	const result: Point[] = [];
	if (poly.length > 2) {
		const discriminant = 3;
		let minx = Infinity;
		let maxX = -Infinity;
		let minY = Infinity;
		let maxY = -Infinity;

		let i: number;
		for (i = 0; i < poly.length; i++) {
			const p = poly[i];
			minx = Math.min(minx, p[0]);
			minY = Math.min(minY, p[1]);
			maxX = Math.max(maxX, p[0]);
			maxY = Math.max(maxY, p[1]);
		}

		let temp: number[];
		let fx: number;
		let fy: number;
		for (let x = minx; x < maxX; x += discriminant) {
			for (let y = minY; y < maxY; y += discriminant) {
				fx = x + ((0.5 - Math.random()) / 2) * discriminant;
				fy = y + ((0.5 - Math.random()) / 2) * discriminant;
				temp = [fx, fy];
				if (cnPnPolyIsIn(temp, poly)) {
					result.push(new Point(fx, fy));
				}
			}
		}
	}

	return result;
}

function cleanBoundaries(polygon: number[][]): number[][] {
	let i: number;
	let done = false;
	let p: number[];
	let q: number[];
	let o: number[];
	let a: { x: number; y: number };
	let b: { x: number; y: number };
	let dx: number;
	let dy: number;
	let d: number;
	let n: number;
	let xj: number;
	let yj: number;
	let j: number;
	while (!done) {
		done = true;
		// Remove duplicates
		for (i = 0; i < polygon.length; i++) {
			p = polygon[i];
			q = polygon[(i + 1) % polygon.length];
			if (Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) < 1e-5) {
				polygon.splice(i, 1);
				i = Math.max(-1, i - 2);
				done = false;
			}
		}
		// Remove collinear edges

		for (i = 0; i < polygon.length; i++) {
			o = polygon[(i - 1 + polygon.length) % polygon.length];
			p = polygon[i];
			q = polygon[(i + 1) % polygon.length];
			a = { x: o[0] - p[0], y: o[1] - p[1] };
			b = { x: q[0] - p[0], y: q[1] - p[1] };
			if (
				Math.abs((a.x * b.x + a.y * b.y) / Math.sqrt((a.x * a.x + a.y * a.y) * (b.x * b.x + b.y * b.y))) >
				1 - 1e-5
			) {
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
		n = Math.ceil(d / 7); // One point every ~7°
		for (j = 1; j < n; j++) {
			// We add orthogonal vector at every 2nd point to create non-collinear edges
			xj = p[0] + (dx * j) / n - dy * (j % 2) * 1e-6;
			yj = p[1] + (dy * j) / n + dx * (j % 2) * 1e-6;
			polygon.splice(i + j, 0, [xj, yj]);
		}

		i += n;
	}

	// There can stll be zero-area triangles between poly and hole
	// This attempts to reduce the probability of such a situation
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
		const holes: Point[][] = [];
		let contour: Point[];
		polygonWithHoles.forEach((polygon, index) => {
			const cleanedBoundaries = cleanBoundaries(polygon);
			if (index === 0) {
				steinerPoints = generateSteinerPointsFor(cleanedBoundaries);
				contour = cleanedBoundaries.map((item) => new Point(item[0], item[1]));
			} else {
				holes.push(cleanedBoundaries.map((item) => new Point(item[0], item[1])));
			}

			return cleanedBoundaries;
		});

		const swCtX = new SweepContext(contour);
		swCtX.addHoles(holes);
		swCtX.addPoints(steinerPoints);
		swCtX.triangulate();
		const triangles = swCtX.getTriangles();
		const verticesPoly2Tri: IPointLike[] = [];

		function findAndAddVertexIndex(p: IPointLike): number {
			const vs = verticesPoly2Tri;
			let out = -1;
			for (let k = 0; k < vs.length && out === -1; k++) {
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

		const indexes: number[] = [];
		triangles.forEach((triangle) => indexes.push(...triangle.getPoints().map((t) => findAndAddVertexIndex(t))));
		// Index n'a que la surface inférieure!
		const vertices = verticesPoly2Tri.map((v) => new Cartographic(v.x, v.y, 0, false));
		// Vertices n'a que la surface inférieure!
		const uvs: number[] = [];
		vertices.forEach((vertex) =>
			uvs.push(vertex.longitude * CONFIGURATION.OVER_TWO_PI + 0.5, vertex.latitude * CONFIGURATION.OVER_PI + 0.5)
		);

		const verticesPerSurfaceCount = vertices.length;
		const indexesPerSurfaceCount = indexes.length;
		// Peuplement de la seconde surface
		for (let i = 0; i < verticesPerSurfaceCount; i++) {
			const carto = vertices[i].clone();
			carto.height = CONFIGURATION.hatHeight;
			vertices.push(carto);
			uvs.push(carto.longitude * CONFIGURATION.OVER_TWO_PI + 0.5, carto.latitude * CONFIGURATION.OVER_PI + 0.5);
		}

		const lateralIndexes: number[] = [];
		let ia: number;
		let ib: number;
		let ian: number;
		let ibn: number;
		for (let i = 0; i < indexesPerSurfaceCount; i += 3) {
			indexes.push(
				indexes[i] + verticesPerSurfaceCount,
				indexes[i + 1] + verticesPerSurfaceCount,
				indexes[i + 2] + verticesPerSurfaceCount
			);
			// Triangles latéraux!
			for (let j = 0; j < 3; j++) {
				ia = indexes[i + j];
				ib = indexes[i + ((j + 1) % 3)];
				ian = indexes[i + j + indexesPerSurfaceCount];
				ibn = indexes[i + ((j + 1) % 3) + indexesPerSurfaceCount];
				lateralIndexes.push(ia, ib, ian, ib, ibn, ian);
			}
		}

		lateralIndexes.forEach((latIndex) => {
			indexes.push(latIndex);
		});
		const tempVertex: number[] = [];
		vertices.forEach((vertex) => tempVertex.push(...vertex.toThreeGLSL()));
		const result: IPreGeometry = {
			vertices: tempVertex,
			extruded: {
				begin: verticesPerSurfaceCount * 3,
				end: verticesPerSurfaceCount * 6,
			},
			uvs: new Float32Array(uvs),
			indexes: new Uint16Array(indexes),
			surfaceBoundary: contour.map((point) => new Cartographic(point.x, point.y, 0, false)),
		};

		return result;
	});
}

function uniqueCaseCounter(list: any[]): string {
	const dictionary = {};
	list.forEach((item) => {
		for (const att in item) {
			if (item.hasOwnProperty(att)) {
				if (!dictionary.hasOwnProperty(att)) {
					dictionary[att] = [];
				}

				if (dictionary[att].includes(item[att])) {
					dictionary[att].push(item[att]);
				}
			}
		}
	});

	return Object.keys(dictionary).sort((a, b) => dictionary[b].length - dictionary[a].length)[0];
}

function maxRectangle(n: number): number[] {
	const primes: number[] = [];
	let width = 1;
	let height = 1;
	let i = 0;
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
	const uniforms: { [x: string]: number | ArrayBufferView } = {};
	uniforms.extrudedHeight = CONFIGURATION.extrudedHeight;
	uniforms.threeRadius = CONFIGURATION.THREE_EARTH_RADIUS;
	uniforms.earthRadius = CONFIGURATION.earthRadiusMeters;
	uniforms.referenceEquiRectangular = CONFIGURATION.referenceEquiRectangularArray;
	uniforms.projectionInit = CONFIGURATION.projectionInit;
	uniforms.projectionEnd = CONFIGURATION.projectionEnd;
	uniforms.percentProjection = CONFIGURATION.percentProjection;
	uniforms.conesShape = CONFIGURATION.conesShape;
	uniforms.curvesPosition = CONFIGURATION.curvesPosition;
	uniforms.standardParallel1 = CONFIGURATION.standardParallel1;
	uniforms.standardParallel2 = CONFIGURATION.standardParallel2;
	_gpgpu.positions.updateUniforms(uniforms);
	const options: { [x: string]: { src: ArrayBufferView; width: number; height: number; depth?: number } } = {
		u_Positions: { src: _vertexArrayEntries, width: _width, height: _height },
	};
	_gpgpu.positions.updateTextures(options);
	const allPositions = _gpgpu.positions.calculate(_width, _height)[0];
	let begin: number;
	let end: number;
	_countries.forEach((country) => {
		begin = country.outputLimits.begin;
		end = country.outputLimits.end;
		country.setGeometry(allPositions.subarray(begin, end));
	});
}

export class CountryMeshShader extends Mesh {
	public otherProperties: any;
	public outputLimits: IMarkLimits;
	private readonly _boundaryBox: IBBox;
	private readonly _extrudedLimits: IMarkLimits;
	private _extrudedPercent: number;
	private readonly _mainProperty: string;

	public static async generateCountries(geoJson: GeoJSON.FeatureCollection): Promise<CountryMeshShader[]> {
		_ready = false;
		_countries = [];
		fullCleanArrays();
		const promise = new Promise((resolve) => {
			if (uuid === undefined) {
				void Promise.all([
					GPUComputer.GPUComputerFactory(
						getShader('countryMeshShader', 'fragment'),
						{ u_Positions: 'RGB32F' },
						1
					).then((instance) => {
						_gpgpu.positions = instance;
						return instance;
					}),
				]).then(() => {
					uuid = CONFIGURATION.addEventListener(
						'heightRatio intrudedHeightRatio referenceEquiRectangular THREE_EARTH_RADIUS ' +
							'projectionBegin projectionEnd projectionPercent tick pointsPerCurve' +
							'modeSelected curvesPosition',
						(name: string) => {
							if (_ready === true) {
								switch (name) {
									case 'tick':
										if (_dirty === true && _tickCount > 10) {
											const options = {
												u_Positions: {
													src: _vertexArrayEntries,
													width: _width,
													height: _height,
												},
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
						}
					);
					resolve(0);
				});
			} else {
				resolve(0);
			}
		});
		await promise;
		if (geoJson.type === 'FeatureCollection') {
			fullCleanArrays();
			const preMeshes: IPreMesh[] = [];
			const uniqueProperties: any[] = [];
			geoJson.features.forEach((feature) => {
				const properties = feature.properties;
				uniqueProperties.push(properties);
				generateVertices(<GeoJSON.MultiPolygon | GeoJSON.Polygon>feature.geometry).forEach((geometry) =>
					preMeshes.push({ geometry, properties })
				);
			});
			const mainProperty = uniqueCaseCounter(uniqueProperties);
			let indexCount = 0;
			let oldIndexCount = 0;
			const vertexArrayEntries: number[] = [];
			preMeshes.forEach((item) => {
				oldIndexCount = indexCount;
				indexCount += item.geometry.vertices.length / 3;
				vertexArrayEntries.push(...item.geometry.vertices);
				const extruded = item.geometry.extruded;
				extruded.begin += oldIndexCount * 3;
				extruded.end += oldIndexCount * 3;
				_countries.push(
					new CountryMeshShader(item, mainProperty, { begin: oldIndexCount * 4, end: indexCount * 4 })
				);
			});

			[_width, _height] = maxRectangle(vertexArrayEntries.length / 3);
			_vertexArrayEntries = new Float32Array(vertexArrayEntries);
			computation();
		} else {
			throw new Error('not a geoJson');
		}

		_ready = true;
		return [..._countries];
	}

	private constructor(preMesh: IPreMesh, mainProperty: string, outputLimits: IMarkLimits) {
		const positionDelta = outputLimits.end - outputLimits.begin;
		const interleavedBufferPosition = new InterleavedBuffer(new Float32Array(positionDelta), 4).setUsage(
			DynamicDrawUsage
		);
		const interleavedBufferAttributePosition = new InterleavedBufferAttribute(
			interleavedBufferPosition,
			3,
			0,
			false
		);
		const interleavedBufferNormal = new InterleavedBuffer(new Float32Array(positionDelta), 4).setUsage(
			DynamicDrawUsage
		);
		const interleavedBufferAttributeNormal = new InterleavedBufferAttribute(interleavedBufferNormal, 3, 0, false);
		const bufferGeometry = new BufferGeometry();
		const preGeometry = preMesh.geometry;
		bufferGeometry.setAttribute('position', interleavedBufferAttributePosition);
		bufferGeometry.setAttribute('normal', interleavedBufferAttributeNormal);
		bufferGeometry.setAttribute('uv', new BufferAttribute(preGeometry.uvs, 2));
		bufferGeometry.setIndex(new BufferAttribute(preGeometry.indexes, 1));
		bufferGeometry.setDrawRange(0, preGeometry.indexes.length);
		bufferGeometry.computeBoundingSphere();
		super(bufferGeometry, CONFIGURATION.COUNTRY_MATERIAL.clone());
		this.otherProperties = preMesh.properties;
		this._boundaryBox = {
			minLat: 1000,
			minLong: 1000,
			maxLat: -1000,
			maxLong: -1000,
			boundary: preGeometry.surfaceBoundary,
		};

		this._boundaryBox.boundary.forEach((pos) => {
			this._boundaryBox.minLong = Math.min(this._boundaryBox.minLong, pos.longitude);
			this._boundaryBox.minLat = Math.min(this._boundaryBox.minLat, pos.latitude);
			this._boundaryBox.maxLong = Math.max(this._boundaryBox.maxLong, pos.longitude);
			this._boundaryBox.maxLat = Math.max(this._boundaryBox.maxLat, pos.latitude);
		});

		this._extrudedLimits = preGeometry.extruded;
		this.outputLimits = outputLimits;
		this._mainProperty = preMesh.properties[mainProperty];
		this.extruded = 1;
		this.castShadow = true;
		this.receiveShadow = true;
	}

	public get bBox(): IBBox {
		return this._boundaryBox;
	}

	public get extruded(): number {
		return this._extrudedPercent;
	}

	public set extruded(value: number) {
		const abs = Math.abs(value);
		if (abs > 0.0001 && abs <= 100) {
			this._extrudedPercent = value;
			const outValue = (value * CONFIGURATION.extrudedHeight) / 100;
			const begin = this._extrudedLimits.begin;
			const end = this._extrudedLimits.end;
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
		let result = false;
		if (
			pos.latitude >= this._boundaryBox.minLat &&
			pos.latitude <= this._boundaryBox.maxLat &&
			pos.longitude >= this._boundaryBox.minLong &&
			pos.longitude <= this._boundaryBox.maxLong
		) {
			result = Cartographic.isInside(pos, this._boundaryBox.boundary);
		}

		return result;
	}

	public setGeometry(positions: Float32Array): void {
		const bufferedGeometry = <BufferGeometry>this.geometry;
		const interleavedBuffer = (<InterleavedBufferAttribute>bufferedGeometry.getAttribute('position')).data;
		interleavedBuffer.set(positions, 0);
		interleavedBuffer.needsUpdate = true;
		bufferedGeometry.computeBoundingSphere();
	}
}
