'use strict';
import { CONFIGURATION } from '../common/configuration';
import {
  MeshBasicMaterial, DoubleSide, MeshPhongMaterial, LineBasicMaterial, FontLoader, TextureLoader, CanvasTexture,
} from 'three';
/**
 * initialise les données de ThreeJS pour l'application (textures, couleurs...)
 *
 * initialising the threejs data of the application (textures, colors, ect.)
 */
export async function prepareConfiguration(): Promise<void> {
  if (CONFIGURATION.COUNTRY_MATERIAL === undefined) {
    let canvas = await loadBoundaries(CONFIGURATION.COUNTRY_TEXTURES.boundaries);
    CONFIGURATION.BASIC_CONE_MATERIAL = new MeshPhongMaterial({
      opacity: 0.8,
      color: 0xebdede,
      side: DoubleSide,
      map: new CanvasTexture(canvas),
    });
    CONFIGURATION.highLitedMaterial = new MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.5,
      side: DoubleSide,
    });
    let earthMaterial = new MeshBasicMaterial({
      opacity: 0.8,
      depthTest: true,
      depthWrite: true,
      side: DoubleSide,
      transparent: true,
    });
    // earthMaterial.map = new TextureLoader().load(CONFIGURATION.COUNTRY_TEXTURES.map);
    earthMaterial.map = new CanvasTexture(canvas);
    earthMaterial.specularMap = new TextureLoader().load(CONFIGURATION.COUNTRY_TEXTURES.specularMap);
    CONFIGURATION.COUNTRY_MATERIAL = earthMaterial;
    CONFIGURATION.BASIC_TEXT_MATERIAL = new MeshPhongMaterial({
      opacity: 1.0,
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
    let loaderFont = new FontLoader();
    loaderFont.load('gentilis_regular.typeface.json', font => {
      CONFIGURATION.TEXT_GEOMETRY_OPTIONS = {
        font: font,
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
  let requete = new Request(url);
  let json: GeoJSON.FeatureCollection = await fetch(requete).then((response) => response.json());
  let canvas = document.createElement('canvas');
  canvas.height = semiHeight * 2;
  canvas.width = semiHeight * 4;
  let context = canvas.getContext('2d');
  context.fillStyle = '#EBDEDEAF';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.textBaseline = 'middle';
  const strokeStyleDefault = 'rgba(0,0,255,0.5)';
  const strokeStyleText = 'rgba(0,255,0,0.5)';
  context.lineWidth = 2;
  json.features.forEach((feature) => {
    let geometry = feature.geometry;
    let name: string = feature.properties.ADM0_A3;
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
      let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
      context.strokeStyle = strokeStyleDefault;
      polygons.forEach((polygon) => {
        let points = polygon.map((point) => {
          let [longitude, latitude] = point;
          let x = longitude * longLat2XY + 2 * semiHeight;
          let y = -latitude * longLat2XY + semiHeight;
          xmin = xmin > x ? x : xmin;
          xmax = xmax < x ? x : xmax;
          ymin = ymin > y ? y : ymin;
          ymax = ymax < y ? y : ymax;
          return { x, y };
        });
        context.beginPath();
        context.moveTo(points[0].x, points[0].y);
        let point: { x: number, y: number };
        for (let i = 1; i < points.length; i++) {
          point = points[i];
          context.lineTo(point.x, point.y);
        }
        context.closePath();
        context.stroke();
      });
      let deltaX = xmax - xmin;
      let deltaY = ymax - ymin;
      context.font = deltaX / 4 + 'px/' + deltaY / 2 + 'px serif';
      context.strokeStyle = strokeStyleText;
      if (deltaX > semiHeight / 100 && deltaX < semiHeight && deltaY > semiHeight / 100 && deltaY < semiHeight) {
        context.fillText(name, xmin + deltaX / 4, ymax - deltaY / 2, deltaX / 2);
      }
    });
  });
  // document.body.appendChild(canvas);
  return canvas;
}
