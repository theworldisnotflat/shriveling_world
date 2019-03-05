/**
 * Project.ts is where all definitions are made
 * concerning data structuring in the project
 *
 * the [data model can be seen here](https://github.com/theworldisnotflat/shriveling_world/blob/master/model/modeles.png)
 */
import { Cartographic } from '../common/utils';
import { Vector3 } from 'three';
import { NEDLocal } from '../common/referential';
export interface ICountryTextureURL {
  map: string;
  specularMap: string;
  bumpMap: string;
  normalMap: string;
}

/**
 * list of available geographic porjections
 */
export enum PROJECTION_ENUM {
  none = 0,
  equirectangular = 1,
  Mercator = 2,
  Winkel = 3,
  Eckert = 4,
  vanDerGrinten = 5,
  conicEquidistant = 6,
}

export type internalFormatType =
  'R8' | 'R32F' | 'R16UI' | 'R16I' | 'R32UI' | 'R32I' |
  'RG8' | 'RG32F' | 'RG16UI' | 'RG16I' | 'RG32UI' | 'RG32I' |
  'RGB8' | 'RGB32F' | 'RGB16UI' | 'RGB16I' | 'RGB32UI' | 'RGB32I' |
  'RGBA8' | 'RGBA32F' | 'RGBA16UI' | 'RGBA16I' | 'RGBA32UI' | 'RGBA32I';

export interface IDimension {
  width: number;
  height: number;
}
export interface INEDLocalGLSL {
  ned2ECEF0: number[];
  ned2ECEF1: number[];
  ned2ECEF2: number[];
  summit: number[];
}
/**
 * in geographic (lat, lon, height) coordinates
 */
export interface ICartographic {
  latitude?: number;
  longitude?: number;
  height?: number;
}

/**
 * to convert from  geographic lat/lon/height to
 * the three d coordinates and back
 */
export interface IConverter {
  converter: (pos: Cartographic, toPack: boolean) => Vector3 | number[];
  reverser: (pos: Vector3) => Cartographic;
}

export interface IConverterLookup {
  [name: string]: IConverter;
}

export interface IMapProjector {
  name: string;
  converter: (pos: Cartographic) => Vector3;
}

/**
 * it's a lookup mapping for a given year the slope angle between earth surface
 * and cone slope as cone radius is fixed, it's the key parameter for cone geometries.
 */
export interface ILookupDirection {
  [year: string]: number;
}

export interface ILookupTransportSpeed {
  [transport: string]: { year: number, speed: number }[];
}

export interface ILookupTransport {
  [transport: string]: ILookupDirection;
}

export interface ILookupDestination {
  [cityCode: string]: ILookupTransportSpeed;
}

export interface ICityTransport {
  referential: NEDLocal;
  transports: ILookupTransport;
  destinations: ILookupDestination;
  cityProperties: ICity;
}

export interface ILookupCityTransport {
  [cityCode: string]: ICityTransport;
}

export interface IItemCriteria {
  value: number | string | Date | boolean;
  comparator?: '=' | '>' | '>=' | '<' | '<=' | '!=';
}

export interface ICriterias {
  [attribut: string]: IItemCriteria;
}

export interface IOrderAscendant {
  attribute: string;
  ascendant: boolean;
}

export type sumUpType = 'number' | 'date' | 'string' | 'array' | 'object' | 'boolean' | 'undefined';

export interface ISumUpCriteriaItem {
  type: sumUpType;
  sumUp?: { max: Date | number, min: Date | number } | string[] | ISumUpCriteria;
}

export interface ISumUpCriteria {
  [attribut: string]: ISumUpCriteriaItem;
}

export interface IPopulation {
  cityCode?: number;
}

/**
 * City interface
 *
 * Parameters attached to each city:
 * * [[urbanagglomeration]] is the name of the city
 * * [[radius]]: number; // for cases of cities in islands close to a continent
 * * [[destinations]] will be determined by scanning the [[ITransportNetwork]]
 */
export interface ICity {
  countryCode: number;
  countryName: string;
  cityCode: number;
  urbanagglomeration: string;
  latitude: number;
  longitude: number;
  radius: number; // for cases of cities in islands close to a continent
  populations?: IPopulation;
  destinations?: ITransportNetwork[];
}

/**
 * for a given [[year]], for a given [[transportModeCode]],
 * the speed of a transport mode [[speedKPH]] may be different
 */
export interface ITransportModeSpeed {
  year: number;
  transportModeCode?: number;
  speedKPH: number;
}

/**
 * A transport mode has a [[name]], a [[code]], a [[yearBegin]],
 * a [[yearEnd]], can be [[terrestrial]] or not,
 * and has a table of [[speeds]] that may change over years
 */
export interface ITransportModeCode {
  name: string;
  code: number;
  yearBegin: number;
  yearEnd?: number;
  terrestrial: boolean;  // if yes the transport mode speed can affect the slope of cones
  speeds: ITransportModeSpeed[];
}

/**
 * Here we have data of each link in the [[ITransportNetwork]]
 *
 * Each link has a [[yearBegin]] and a [[yearEnd]]
 * * an origin [[idOri]] and  destination [[idDes]]
 * * a transport mode [[transportMode]]
 * * [[destination]]:??
 */
export interface ITransportNetwork {
  yearBegin: number;
  yearEnd?: number;
  idOri?: number;
  idDes: number;
  transportMode: number;
  destination?: number;
}

export interface IBBox {
  minLat: number;
  maxLat: number;
  minLong: number;
  maxLong: number;
  boundary: Cartographic[];
}

export interface IPseudoGeometry {
  uv: ArrayBuffer;
  index: ArrayBuffer;
  vertices: { [projectionName: string]: ArrayBuffer };
}

export interface IPseudoGeometryPremises {
  withLimits: IPseudoGeometry;
  withoutLimits: IPseudoGeometry;
}

export interface ILookupPseudoGeometryPremises {
  [year: string]: IPseudoGeometryPremises;
}

export interface ILookupCityPseudoGeometryPremises extends IEndCityLine {
  transports: { [transport: string]: ILookupPseudoGeometryPremises };
  otherProperties: any;
}

export interface IDataConeGeneratorIn {
  lookup: ILookupCityTransport;
  bboxes: IBBox[];
  distance: number;
}

export type MessageConeShaderType = 'init' | 'coneStep' | 'year' | 'limits' | 'projectionBegin' | 'other' | 'information';
export interface IDataMessageConeShader {
  cities?: { [cityCode: string]: NEDLocal };
  bboxes?: IBBox[];
  cones?: { cityCode: string, directions: ILookupDirection }[];
  conestep?: number;
  year?: string;
  limits?: ArrayBuffer;
  uniforms?: { [x: string]: number | ArrayBufferView };
}
export interface IMessageConeShader {
  action: MessageConeShaderType;
  data: IDataMessageConeShader;
}
export interface ITypeExtrusion {
  none: number;
  extruded: number;
}
export type IMergerState = 'missing' | 'ready' | 'pending' | 'complete';

export type configurationObservableEvt =
  'heightRatio' | 'intrudedHeightRatio' | 'coneStep' | 'TWEEN_TIMING' | 'referenceEquiRectangular' | 'pointsPerLine' |
  'THREE_EARTH_RADIUS' | 'projectionBegin' | 'projectionEnd' | 'projectionPercent' | 'year' | 'tick';

export type configurationCallback = (name: configurationObservableEvt, value: any) => void;
export type ShaderTypes = 'fragment' | 'vertex';
export interface ILookupAndMaxSpeedAndLine {
  lookupCityTransport: ILookupCityTransport;
  lineData: ILookupLine;
}
export interface ILookupTransportPerYear {
  [year: string]: string;
}
export interface IEndCityLine {
  cityCode: string | number;
  position: Cartographic;
}
export interface ILookupItemList {
  end: IEndCityLine;
  pointP: Cartographic;
  pointQ: Cartographic;
  middle: Cartographic;
  ratio: { [transportName: string]: { [year: string]: number } };
  opening: number;
}
export interface ILookupLineItem {
  begin: IEndCityLine;
  list: { [cityCodeEnd: string]: ILookupItemList };
}
export interface ILookupLine {
  [cityCodeBegin: number]: ILookupLineItem;
}
export interface IMarkLimits {
  begin: number; // inclusif
  end: number; // exclusif
}
export interface IListFile {
  name: string;
  text: string;
}
