/**
 * Project.ts is where all definitions are enunciated
 * concerning data structuring in the project
 *
 * the [data model can be seen here](https://github.com/theworldisnotflat/shriveling_world/blob/master/model/modeles.png)
 */
import { Cartographic } from '../common/utils';
import { NEDLocal } from '../common/referential';
export interface ICountryTextureURL {
  map: string;
  specularMap: string;
  bumpMap: string;
  normalMap: string;
}

/**
 * list of available geographic projections
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
 * it's a lookup mapping for a given year the slope angle between earth surface
 * and cone slope as cone radius is determined, it's the key parameter for cone geometries.
 *
 * This slope (alpha) is determined by ![equation 1](http://bit.ly/2tLfehC)
 */
export interface ILookupAlpha {
  [year: string]: number;
}

/**
 * A transport mode has a given speed for a given year
 *
 * Table of couples year-speed for each transport mode
 */
export interface ILookupTranspModeSpeed {
  [transpModeCode: string]: { year: number, speed: number }[];
}

/**
 * A transport mode is associated to a cone slope (alpha)
 * for a given year
 */
export interface ILookupTransportModeAlpha {
  [transpModeCode: string]: ILookupAlpha;
}

/**
 * a table of destination cities and the associated
 * transport modes and their respective speed
 */
export interface ILookupDestAndModes {
  [cityCode: string]: ILookupTranspModeSpeed;
}

/**
 * A city and the incident edges of the netork:
 * * a refential of coordinates
 * * a table of transport modes and their alphas
 * * a list of destinations
 * * a group of [[cityProperties]]
 */
export interface ICityNetwork {
  referential: NEDLocal;
  transpModesAlpha: ILookupTransportModeAlpha;
  destAndModes: ILookupDestAndModes;
  origCityProperties: ICity;
}
/**
 * a [[ILookupCityTransport]] associates
 * * a [[cityCode]]
 * * and a piece of network: [[ICityTransport]]
 * <uml>
 * [[ILookupCityTransport]]<-[[ICityTransport]]
 * </uml>
 */
export interface ILookupCityTransport {
  [cityCode: string]: ICityNetwork;
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
 * * [[destinations]] is a table will be determined by scanning the [[ITransportNetwork]]
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
  edges?: ITransportNetwork[];
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
  // destination?: number;
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

export type IMergerState = 'missing' | 'ready' | 'pending' | 'complete';

/**
 * * 'intrudedHeightRatio' heigth of the cone expressed in proportion to the earth radius
 * * 'coneStep' is the value in degree of the facet of the cone; low value means high definition of the geometry of cones
 */
export type configurationObservableEvt =
  'heightRatio' | 'intrudedHeightRatio' | 'coneStep' | 'TWEEN_TIMING' | 'referenceEquiRectangular' | 'pointsPerLine' |
  'THREE_EARTH_RADIUS' | 'projectionBegin' | 'projectionEnd' | 'projectionPercent' | 'year' | 'tick';

export type configurationCallback = (name: configurationObservableEvt, value: any) => void;
export type ShaderTypes = 'fragment' | 'vertex';
/**
 *
 */
export interface ILookupAndMaxSpeedAndLine {
  lookupCityTransport: ILookupCityTransport;
  lineData: ILookupEdge;
}
/**
 * defines the city at the other extremity of and edge
 */
export interface ICityExtremityOfEdge {
  cityCode: string | number;
  position: Cartographic;
}
/**
 * data associated to an edge from a given city
 *
 * [[pointP]] and [[pointQ]] are control points for Bezier curves
 *
 * [[theta]] is the angle between cities
 */
export interface ILookupEdgeList {
  end: ICityExtremityOfEdge;
  pointP: Cartographic;
  pointQ: Cartographic;
  middle: Cartographic;
  ratio: { [transportName: string]: { [year: string]: number } };
  theta: number;
}
/**
 * Line (or edge) items include: ????????
 * je suis perplexe devant la ligne: 'begin: IEndCityLine' ???????????????????????
 */
export interface ILookupLineItem {
  begin: ICityExtremityOfEdge;
  list: { [cityCodeEnd: string]: ILookupEdgeList };
}
/**
 * a line and its associated graph edge has a [[cityCodeBegin]]
 *
 * other parameters of this line derive from the [[ILookupLineItem]]
 */
export interface ILookupEdge {
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
