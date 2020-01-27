'use strict';
import {
  BufferGeometry, Geometry, InterleavedBufferAttribute, BufferAttribute, InterleavedBuffer,
} from 'three';
import { CONFIGURATION } from '../common/configuration';
import { PseudoCone } from './base';
import { Cartographic, interpolator, matchingBBox } from '../common/utils';
import { ILookupCityNetwork, IBBox, ILookupComplexAlpha, IComplexAlphaItem } from '../definitions/project';
import { NEDLocal, Coordinate } from '../common/referential';
import { Shaders } from '../shaders';
import { GPUComputer } from '../common/gpuComputer';
const forbiddenAttributes = ['referential', 'terrestrialCone'];

/**
 * [[IShaderAlpha]] is a table of alphas with years
 */
interface IShaderAlpha {
  [year: string]: Float32Array;
}

let _cones: ConeMeshShader[];
let _indexesArr: Uint16Array;
let _localLimitsLookup: { [x: string]: { clock: number, distance: number }[] };
let _cityCodeOrder: string[];
let uuid: string = undefined;
let _dirtyLimits = false;
let _tickCount = 0;
let _ready = false;
let _width: number;
let _height: number;
let _discriminant = 2;

/**
 * a list of [[GPUComputer]]
 */
let _gpgpu: { [x: string]: GPUComputer } = {};

let _clocks: Float32Array;
let _alphas: IShaderAlpha;

/**
 * Generates empty arrays of
 * * [[_localLimitsLookup]]
 * * [[_cityCodeOrder]]
 * * [[_clocks]] i.e. unitary trinagular elements to compose cones
 * * [[_alphas]] cones angles
 * * [[_indexesArr]]
 */
function fullCleanArrays(): void {
  _localLimitsLookup = {};
  _cityCodeOrder = [];
  _clocks = new Float32Array(0);
  _alphas = {};
  _indexesArr = new Uint16Array(0);
}
fullCleanArrays();

/**
 * function [[localLimitsRaw]]
 * @param boundaries
 * @param referential
 */
function localLimitsRaw(
  boundaries: Cartographic[][], referential: NEDLocal): { clock: number, distance: number }[] {
  let allPoints: Coordinate[] = [];
  boundaries.forEach((boundary) => {
    boundary.forEach((position) => {
      allPoints.push(referential.cartographic2NED(position));
    });
  });
  let resultat: { clock: number, distance: number }[] = [];
  allPoints.forEach((pos) => {
    let clook = Math.atan2(pos.y, pos.x);
    let distance = Math.sqrt(pos.x * pos.x + pos.y * pos.y + pos.z * pos.z);
    resultat.push(
      { clock: clook, distance: distance },
      { clock: clook + CONFIGURATION.TWO_PI, distance: distance },
      { clock: clook - CONFIGURATION.TWO_PI, distance: distance },
    );
  });
  resultat.sort((a, b) => a.clock - b.clock);
  return resultat;
}

/**
 * function [[localLimitsFunction]]
 * @param tab
 * @param coneStep
 */
function localLimitsFunction(tab: { clock: number, distance: number }[], coneStep = CONFIGURATION.coneStep): (x: number) => number {
  let clockDistance = tab.reduce(
    (result, current) => {
      let clockClass = Math.floor(current.clock / coneStep) * coneStep;
      result[clockClass] = result[clockClass] === undefined ? current.distance : Math.min(result[clockClass], current.distance);
      return result;
    },
    {});
  let temporaire: { clock: number, distance: number }[] = [];
  for (let clockString in clockDistance) {
    if (clockDistance.hasOwnProperty(clockString)) {
      temporaire.push({ clock: parseFloat(clockString), distance: clockDistance[clockString] });
    }
  }
  return interpolator(temporaire, 'clock', 'distance');
}

/**
 * function [[regenerateFromConeStep]] when [[coneStep]] is modified
 *
 * [[clocks]] are unitary triangles that compose cones, the higher [[conestep]] the smaller clocks are
 */
function regenerateFromConeStep(): void {
  const step = CONFIGURATION.coneStep;
  let clocks: number[] = [];
  let index: number[] = [];
  let ia: number, ib: number, iab: number, ibb: number;
  for (let i = 0; i < CONFIGURATION.TWO_PI; i += step) {
    clocks.push(i);
  }
  clocks.push(-1);
  _width = clocks.length;
  for (let i = 0; i < _width - 1; i++) {
    ia = i;
    ib = (ia + 1) % (_width - 1);
    index.push(ia, ib, _width - 1);
    iab = ia + _width;
    ibb = ib + _width;
    index.push(iab, ibb, (2 * _width) - 1);
    index.push(ia, ib, iab, iab, ibb, ib);
  }
  _clocks = new Float32Array(clocks);
  _indexesArr = new Uint16Array(index);

  let cacheBoundary: { [cityCode: string]: Float32Array } = {};
  for (let cityCode in _localLimitsLookup) {
    if (_localLimitsLookup.hasOwnProperty(cityCode)) {
      let localBoundaryFunction = localLimitsFunction(_localLimitsLookup[cityCode]);
      let tempTab = new Float32Array(_width);
      for (let i = 0; i < _width; i++) {
        tempTab[i] = localBoundaryFunction(_clocks[i]);
      }
      cacheBoundary[cityCode] = tempTab;
    }
  }
  let boundaries = new Float32Array(_width * _height);
  for (let i = 0; i < _height; i++) {
    boundaries.set(cacheBoundary[_cityCodeOrder[i]], i * _width);
  }

  let options = {
    u_clocks: { src: _clocks, width: _width, height: 1 },
    u_boundaryLimits: { src: boundaries, width: _width, height: _height },
  };
  _gpgpu.positions.updateTextures(options);
}

/**
 * function [[updateAlphas]] sets the alpha (fixing slopes) of cones according to year
 * and deals with cones that shouldnt be displayed
 *
 * will call function [[getcomplexAlpha]]
 */
function updateAlphas(): void {
  let year = CONFIGURATION.year;
  const twoPI = CONFIGURATION.TWO_PI;
  const ecartMinimum = _discriminant * CONFIGURATION.coneStep;
  let clockA: number, clockB: number;
  let interpol: (x: number) => number;
  if (!_alphas.hasOwnProperty(year)) {
    let temp = new Float32Array(_height * _width);
    for (let i = 0; i < _height; i++) {
      let complexAlpha = _cones[i].getcomplexAlpha(year);
      let roadAlpha = complexAlpha.roadAlpha;
      let alphaTab = [...complexAlpha.tab];
      let subAlphas: Float32Array;
      const length = alphaTab.length;
      if (length === 0) { // il n'y a pas de destination avec un transport terrestre.
        subAlphas = _clocks.map(() => roadAlpha);
      } else {
        let lastItem = { clock: 0, alpha: 0 };
        lastItem.clock = alphaTab[length - 1].clock - twoPI;
        lastItem.alpha = alphaTab[length - 1].alpha;
        let firstItem = { clock: 0, alpha: 0 };
        firstItem.clock = alphaTab[0].clock + twoPI;
        firstItem.alpha = alphaTab[0].alpha;
        // ajout croisés des éléments extrêmes pour avoir un tableau débordant le domaine [0, 2PI].
        alphaTab.push(firstItem);
        alphaTab.splice(0, 0, lastItem);
        for (let i = length + 1; i > 0; i--) {
          clockA = alphaTab[i - 1].clock;
          clockB = alphaTab[i].clock;
          if (clockB - clockA > ecartMinimum) { // ajout d'une pente de route quand
            // l'écart d'azimut entre deux destinations est trop grande
            alphaTab.splice(i, 0, { alpha: roadAlpha, clock: clockA + (clockB - clockA) / 2 });
          }
        }
        interpol = interpolator(alphaTab, 'clock', 'alpha');
        subAlphas = _clocks.map((clock) => interpol(clock));
      }
      temp.set(subAlphas, i * _width);
    }
    _alphas[year] = temp;
  }
  let options = {
    u_alphas: { src: _alphas[year], width: _width, height: _height },
  };
  _gpgpu.positions.updateTextures(options);
}

/**
 * function [[updateWithLimits]] will apply the [[withLimits]] choice
 */
function updateWithLimits(): void {
  let withLimits = new Float32Array(_height);
  for (let i = 0; i < _height; i++) {
    withLimits[i] = _cones[i].withLimits ? 1 : 0;
  }
  let options = {
    u_withLimits: { src: withLimits, width: 1, height: _height },
  };
  _gpgpu.positions.updateTextures(options);
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
  uniforms.standardParallel1 = CONFIGURATION.standardParallel1;
  uniforms.standardParallel2 = CONFIGURATION.standardParallel2;
  _gpgpu.positions.updateUniforms(uniforms);
  let [begins, uvs, bases] = _gpgpu.positions.calculate(_width, _height);

  let finalPositions = new Float32Array((_width * 2) * _height * 4);
  let finalUV = new Float32Array((_width * 2) * _height * 4);
  let offset: number, end: number;
  for (let i = 0; i < _height; i++) {
    offset = i * (_width * 2) * 4;
    finalPositions.set(begins.subarray(i * _width * 4, (i + 1) * _width * 4), offset);
    finalPositions.set(bases.subarray(i * _width * 4, (i + 1) * _width * 4), offset + 4 * _width);
    finalUV.set(uvs.subarray(i * _width * 4, (i + 1) * _width * 4), offset);
    finalUV.set(uvs.subarray(i * _width * 4, (i + 1) * _width * 4), offset + 4 * _width);
  }

  for (let i = 0; i < _height; i++) {
    offset = i * (_width * 2) * 4;
    end = offset + 2 * 4 * _width;
    _cones[i].setGeometry(finalPositions.subarray(offset, end), finalUV.subarray(offset, end));
  }
}
/**
 * class [[ConeMeshShader]]
 */
export class ConeMeshShader extends PseudoCone {

  public otherProperties: any;
  private _withLimits: boolean;
  private _cityCode: string;
  // private _transportName: string;
  private _position: Cartographic;
  private _complexAlpha: ILookupComplexAlpha;

  /**
   * will [[generateCones]] from [[cityNetwork]]
   * @param lookup
   * @param bboxes
   */
  public static async generateCones(
    lookup: ILookupCityNetwork, bboxes: IBBox[]): Promise<ConeMeshShader[]> {
    _ready = false;
    _cones = [];
    fullCleanArrays();
    let promise = new Promise((resolve) => {
      if (uuid === undefined) {
        Promise.all([
          GPUComputer.GPUComputerFactory(
            Shaders.getShader('coneMeshShader', 'fragment'), {
              u_clocks: 'R32F',
              u_alphas: 'R32F',
              u_boundaryLimits: 'R32F',
              u_summits: 'RGB32F',
              u_ned2ECEF0s: 'RGB32F',
              u_ned2ECEF1s: 'RGB32F',
              u_ned2ECEF2s: 'RGB32F',
              u_withLimits: 'R32F',
            },
            3).then(
              (instance) => {
                _gpgpu.positions = instance;
                return instance;
              }),
        ]).then(() => {
          uuid = CONFIGURATION.addEventListener(
            'heightRatio intrudedHeightRatio coneStep  referenceEquiRectangular THREE_EARTH_RADIUS ' +
            'projectionBegin projectionEnd projectionPercent year tick',
            (name: string) => {
              if (_ready === true) {
                switch (name) {
                  case 'coneStep':
                    _clocks = new Float32Array(0);
                    _alphas = {};
                    _indexesArr = new Uint16Array(0);
                    regenerateFromConeStep();
                    updateAlphas();
                    updateWithLimits();
                    computation();
                    break;
                  case 'year':
                    updateAlphas();
                    updateWithLimits();
                    computation();
                    break;
                  case 'tick':
                    if (_dirtyLimits === true && _tickCount > 10) {
                      updateWithLimits();
                      computation();
                      _tickCount = 0;
                      _dirtyLimits = false;
                    } else {
                      _tickCount++;
                    }
                    break;
                  case 'projectionBegin':
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

    await promise;
    let summits: number[] = [];
    let ned2ECEF0: number[] = [];
    let ned2ECEF1: number[] = [];
    let ned2ECEF2: number[] = [];
    for (let cityCode in lookup) {
      if (lookup.hasOwnProperty(cityCode)) {
        let cityTransport = lookup[cityCode];
        let position = cityTransport.referential.cartoRef;
        let referentialGLSL = cityTransport.referential.ned2ECEFMatrix;
        let terrestrialData = cityTransport.terrestrialCone;
        _localLimitsLookup[cityCode] = localLimitsRaw(matchingBBox(position, bboxes), cityTransport.referential);
        let commonProperties = {};
        for (let attribute in cityTransport) {
          if (cityTransport.hasOwnProperty(attribute) && forbiddenAttributes.indexOf(attribute) === -1) {
            commonProperties[attribute] = cityTransport[attribute];
          }
        }
        _cones.push(new ConeMeshShader(cityCode, position, terrestrialData, commonProperties));
        _cityCodeOrder.push(cityCode);
        summits.push(...referentialGLSL.summit);
        ned2ECEF0.push(...referentialGLSL.ned2ECEF0);
        ned2ECEF1.push(...referentialGLSL.ned2ECEF1);
        ned2ECEF2.push(...referentialGLSL.ned2ECEF2);
      }
    }
    _height = _cones.length;
    let options = {
      u_summits: { src: new Float32Array(summits), width: 1, height: _height },
      u_ned2ECEF0s: { src: new Float32Array(ned2ECEF0), width: 1, height: _height },
      u_ned2ECEF1s: { src: new Float32Array(ned2ECEF1), width: 1, height: _height },
      u_ned2ECEF2s: { src: new Float32Array(ned2ECEF2), width: 1, height: _height },
    };
    _gpgpu.positions.updateTextures(options);
    regenerateFromConeStep();
    updateAlphas();
    updateWithLimits();
    computation();
    _ready = true;
    return [..._cones];
  }

  public static get discriminant(): number {
    return _discriminant;
  }
  public static set discriminant(value: number) {
    _discriminant = value;
    _alphas = {};
    updateAlphas();
    computation();
  }
  public dispose(): void {
    super.dispose();
  }

  /**
   * [[setGeometry]]
   */
  public setGeometry(positions: Float32Array, uv: Float32Array): void {
    let geometry = <Geometry>this.geometry;
    geometry.computeFaceNormals();
    let bufferedGeometry = <BufferGeometry>this.geometry;
    let interleavedBuffer = (<InterleavedBufferAttribute>bufferedGeometry.getAttribute('position')).data;
    interleavedBuffer.set(positions, 0);
    interleavedBuffer.needsUpdate = true;
    // bufferedGeometry.computeVertexNormals();
    bufferedGeometry.computeBoundingSphere();
    interleavedBuffer = (<InterleavedBufferAttribute>bufferedGeometry.getAttribute('uv')).data;
    interleavedBuffer.set(uv, 0);
    interleavedBuffer.needsUpdate = true;
    if (bufferedGeometry.drawRange.count !== _indexesArr.length) {
      bufferedGeometry.getIndex().set(_indexesArr);
      bufferedGeometry.getIndex().needsUpdate = true;
      bufferedGeometry.setDrawRange(0, _indexesArr.length);
    }
  }

  /**
   * return a [[IComplexAlphaItem]] corresponding to a year for the city defined in this [[ConeMeshShader]]
   * @param year
   */
  public getcomplexAlpha(year: string | number): IComplexAlphaItem {
    return this._complexAlpha[year];
  }

  /**
   * constructor
   * @param cityCode
   * @param position
   * @param terrestrialData // cone angles
   * @param properties
   */
  private constructor(cityCode: string, position: Cartographic, terrestrialData: ILookupComplexAlpha, properties: any) {
    const interleavedBufferPosition = new InterleavedBuffer(new Float32Array(400 * 4 * 2), 4).setDynamic(true);
    const interleavedBufferAttributePosition = new InterleavedBufferAttribute(interleavedBufferPosition, 3, 0, false);
    const interleavedBufferUV = new InterleavedBuffer(new Float32Array(400 * 4 * 2), 4).setDynamic(true);
    const interleavedBufferAttributeUV = new InterleavedBufferAttribute(interleavedBufferUV, 3, 0, false);
    const bufferGeometry = new BufferGeometry();
    bufferGeometry.addAttribute('position', interleavedBufferAttributePosition);
    bufferGeometry.addAttribute('uv', interleavedBufferAttributeUV);
    bufferGeometry.setIndex(new BufferAttribute(new Uint16Array(400 * 6 * 2), 1).setDynamic(true));
    bufferGeometry.setDrawRange(0, 0);
    bufferGeometry.computeBoundingSphere();
    super(bufferGeometry, CONFIGURATION.BASIC_CONE_MATERIAL.clone());
    this._cityCode = cityCode;
    this._position = position;
    this.otherProperties = properties;
    this._complexAlpha = terrestrialData;
    this._withLimits = true;
    this.visible = true;
    this.castShadow = true;
    // this.receiveShadow = true;

  }

  get cityCode(): string {
    return this._cityCode;
  }
  get cartographicPosition(): Cartographic {
    return this._position;
  }

  get withLimits(): boolean {
    return this._withLimits;
  }

  set withLimits(value: boolean) {
    if (value !== this._withLimits) {
      _dirtyLimits = true;
      this._withLimits = value;
    }
  }
}
