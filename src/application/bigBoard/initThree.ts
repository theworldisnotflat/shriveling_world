'use strict';
import { CONFIGURATION } from '../common/configuration';
import { MeshBasicMaterial, DoubleSide, MeshPhongMaterial, LineBasicMaterial, FontLoader, CanvasTexture } from 'three';
/**
 * Initialise les données de ThreeJS pour l'application (textures, couleurs...)
 *
 * initialising the threejs data of the application (textures, colors, ect.)
 */
export async function prepareConfiguration(): Promise<void> {
	if (CONFIGURATION.COUNTRY_MATERIAL === undefined) {
		const canvas = await loadBoundaries(CONFIGURATION.COUNTRY_TEXTURES.boundaries);
		CONFIGURATION.BASIC_CONE_MATERIAL = new MeshPhongMaterial({
			color: 0xebdede,
			emissive: 0xebdede,
			transparent: true,
			opacity: 0.8,
			side: DoubleSide,
			map: new CanvasTexture(canvas),
			flatShading: true,
		});
		CONFIGURATION.highLightedMaterial = new MeshBasicMaterial({
			color: 0xebdede,
			transparent: true,
			opacity: 0.5,
			side: DoubleSide,
		});
		const earthMaterial = new MeshBasicMaterial({
			opacity: 0.8,
			// DepthTest: true,
			// depthWrite: true,
			side: DoubleSide,
			transparent: true,
		});
		// EarthMaterial.map = new TextureLoader().load(CONFIGURATION.COUNTRY_TEXTURES.map);
		earthMaterial.map = new CanvasTexture(canvas);
		// EarthMaterial.specularMap = new TextureLoader().load(CONFIGURATION.COUNTRY_TEXTURES.specularMap);
		CONFIGURATION.COUNTRY_MATERIAL = earthMaterial;
		CONFIGURATION.BASIC_TEXT_MATERIAL = new MeshPhongMaterial({
			opacity: 1,
			color: 0xebdede,
			side: DoubleSide,
		});
		CONFIGURATION.BASIC_LINE_MATERIAL = new LineBasicMaterial({
			color: 0x1000ff,
			linewidth: 0.5,
			side: DoubleSide,
			transparent: true,
			opacity: 0.3,
		});
		const loaderFont = new FontLoader();
		loaderFont.load('assets/gentilis_regular.typeface.json', (font) => {
			CONFIGURATION.TEXT_GEOMETRY_OPTIONS = {
				font,
				size: 0.3,
				height: 1,
				curveSegments: 3,
				bevelEnabled: false,
				bevelThickness: 0,
				bevelSize: 0,
				bevelSegments: 0,
			};
		});
	}
}

const semiHeight = 1024;
const longLat2XY = semiHeight / 90;
async function loadBoundaries(url: string): Promise<HTMLCanvasElement> {
	const request = new Request(url);
	const json: GeoJSON.FeatureCollection = await fetch(request).then(async (response) => response.json());
	const canvas = document.createElement('canvas');
	canvas.height = semiHeight * 2;
	canvas.width = semiHeight * 4;
	const context = canvas.getContext('2d');
	context.fillStyle = '#EBDEDEAF';
	context.fillRect(0, 0, canvas.width, canvas.height);
	context.textBaseline = 'middle';
	// Const strokeStyleDefault = 'rgba(0,0,255,0.5)';
	// const strokeStyleText = 'rgba(0,255,0,0.5)';
	context.lineWidth = 2;
	json.features.forEach((feature) => {
		const geometry = feature.geometry;
		const name: string = feature.properties.ADM0_A3;
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

		coordinates.forEach((polygons) => {
			let xMin = Infinity;
			let xMax = -Infinity;
			let yMin = Infinity;
			let yMax = -Infinity;
			const hue = Math.floor(Math.random() * 360 + 0.5);
			const saturation = Math.floor(Math.random() * 100 + 0.5);
			const lightness = Math.floor(Math.random() * 100 + 0.5);
			const contain = `hsl(${hue},${saturation}%,${lightness}%)`;
			context.strokeStyle = contain;
			polygons.forEach((polygon) => {
				const points = polygon.map((point) => {
					const [longitude, latitude] = point;
					const x = longitude * longLat2XY + 2 * semiHeight;
					const y = -latitude * longLat2XY + semiHeight;
					xMin = xMin > x ? x : xMin;
					xMax = xMax < x ? x : xMax;
					yMin = yMin > y ? y : yMin;
					yMax = yMax < y ? y : yMax;
					return { x, y };
				});
				context.beginPath();
				context.moveTo(points[0].x, points[0].y);
				let point: { x: number; y: number };
				for (let i = 1; i < points.length; i++) {
					point = points[i];
					context.lineTo(point.x, point.y);
				}

				context.closePath();
				context.stroke();
				context.fillStyle = contain;
				context.fill();
			});
			const deltaX = xMax - xMin;
			const deltaY = yMax - yMin;
			context.font = deltaX / 4 + 'px/' + deltaY / 2 + 'px serif';
			context.fillStyle = `hsl(${(hue + 180) % 360},${saturation}%,${lightness}%)`;
			if (deltaX > semiHeight / 100 && deltaY > semiHeight / 100) {
				context.fillText(name, xMin + deltaX / 4, yMax - deltaY / 2, deltaX / 2);
			}
		});
	});
	// Document.body.appendChild(canvas);
	return canvas;
}
