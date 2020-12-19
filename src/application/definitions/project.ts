/**
 * Project.ts is where all definitions are enunciated
 * concerning data structuring in the project
 *
 * the [data model can be seen here](https://github.com/theworldisnotflat/shriveling_world/blob/master/model/modeles7.png)
 * Explanations about the [terminology choices can be found here](https://timespace.hypotheses.org/177)
 */
import type { Cartographic } from '../common/utils';
import type { NEDLocal } from '../common/referential';
export interface ICountryTextureURL {
	map: string;
	specularMap: string;
	bumpMap: string;
	normalMap: string;
	boundaries: string;
}

/**
 * List of available geographic projections
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
	| 'R8'
	| 'R32F'
	| 'R16UI'
	| 'R16I'
	| 'R32UI'
	| 'R32I'
	| 'RG8'
	| 'RG32F'
	| 'RG16UI'
	| 'RG16I'
	| 'RG32UI'
	| 'RG32I'
	| 'RGB8'
	| 'RGB32F'
	| 'RGB16UI'
	| 'RGB16I'
	| 'RGB32UI'
	| 'RGB32I'
	| 'RGBA8'
	| 'RGBA32F'
	| 'RGBA16UI'
	| 'RGBA16I'
	| 'RGBA32UI'
	| 'RGBA32I';

export interface INEDLocalGLSL {
	ned2ECEF0: number[];
	ned2ECEF1: number[];
	ned2ECEF2: number[];
	summit: number[];
}
/**
 * In geographic (lat, lon, height) coordinates
 */
export interface ICartographic {
	latitude?: number;
	longitude?: number;
	height?: number;
}

/**
 * An item grouping for a fixed year and a fixed origin city datas to generate
 * a complex cone the slope for road and slope for each
 * destination city (clock) using a terrestrial transport.
 */
export interface IComplexAlphaItem {
	/**
	 * This property represents the slope of the road transport for the considered year.
	 */
	coneAlpha: number;
	/**
	 * This property lists for the considered year and the considered origin city
	 * each destination city using a terrestrial transport. Each item of this
	 * array is a clock in direction of the destination city and a slope
	 * corresponding to the transport speed linking the two cities. This array can have zero item.
	 */
	tab: Array<{ clock: number; alpha: number }>;
}

/**
 * It's a lookup mapping for a given year the slope angle between earth surface
 * and cone slope as cone radius is determined, it's the key parameter for cone geometries.
 *
 * This slope (alpha) is determined by ![equation 1](http://bit.ly/2tLfehC)
 */
export interface ILookupComplexAlpha {
	[year: string]: IComplexAlphaItem;
}

/**
 * A transport mode has a given speed for a given year
 *
 * Table of couples year-speed for each transport mode
 */
export interface ILookupTranspModeSpeed {
	[transpModeCode: string]: Array<{ year: number; speed: number }>;
}

/**
 * A transport mode is associated to a cone slope (alpha)
 * for a given year
 */
// export interface ILookupConeAlpha {
//   [transpModeCode: string]: ILookupAlpha;
// }

/**
 * a table of destination [[cityCode]] and the associated
 * transport modes and their respective speed
 */
export interface ILookupDestWithModes {
	[cityCode: string]: ILookupTranspModeSpeed;
}

/**
 * A city and its incident edges in the network:
 * * a [[referential]] of coordinates in [[NEDLocal]]
 * * a table of transport modes and their alphas
 * * a list of destinations and associated transport modes
 * forming the sub-graph edges (centred on the city)
 * * a table of [[origCityProperties]]
 */
export interface ICityGraph {
	referential: NEDLocal; // À inhiber dans forbiddenAttributes de coneMeshShader
	cone: ILookupComplexAlpha; // À inhiber dans forbiddenAttributes de coneMeshShader
	destinationsWithModes: ILookupDestWithModes;
	origCityProperties: ICity;
}
/**
 * A [[ILookupCityGraph]] searches
 * * a cityCode
 * * and retrieves a piece of network [[ICityNetwork]] made of
 * * incident edges of cityCode in the transport network
 *
 * <uml>
 *     ILookupCityGraph<-ICityGraph
 * </uml>
 */
export interface ILookupCityGraph {
	[cityCode: string]: ICityGraph;
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
	sumUp?: { max: Date | number; min: Date | number } | string[] | ISumUpCriteria;
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
 * * [[countryCode]]
 * * [[countryName]]
 * * [[cityCode]]
 * * [[urbanAgglomeration]] is the name of the city
 * * [[radius]]: number; // for cases of cities in islands close to a continent
 * * [[populations]] (optionnal) for several years as provided in csv file 'population.csv'
 * * [[edges]] (optionnal) is a table will be determined by scanning the [[ITransportNetwork]]
 */
export interface ICity {
	countryCode: number;
	countryName: string;
	cityCode: number;
	urbanAgglomeration: string;
	latitude: number;
	longitude: number;
	radius: number; // For cases of cities in islands close to a continent
	populations?: IPopulation;
	edges?: IEdge[];
}

/**
 * The [[speedKPH]] of a given transport mode may be different
 * depending on [[year]]
 */
export interface ITransportModeSpeed {
	year: number;
	transportModeCode?: number;
	speedKPH: number;
}

/**
 * A transport mode has
 * * a [[name]],
 * * a [[code]],
 * * a [[mYearBegin]],
 * * a [[yearEnd]] (optionnal),
 * * can be [[terrestrial]] or not,
 * * and has a table of [[speeds]] that may change over years
 *
 * If mode is 'terrestrial' the transport mode speed can affect the slope of cones
 */
export interface ITranspMode {
	name: string;
	code: number;
	mYearBegin: number;
	mYearEnd?: number;
	terrestrial: boolean; // If yes the transport mode speed can affect the slope of cones
	speeds: ITransportModeSpeed[];
}

/**
 * Here we find data of a graph edge in the [[IEdge]]
 *
 * Each edge has
 * * a [[yearBegin]] and
 * * a [[yearEnd]] (optionnal)
 * * an origin [[cityCodeOri]] (optionnal)
 * * and  destination [[cityCodeDes]]
 * * a transport mode [[transportMode]]
 */
export interface IEdge {
	yearBegin: number;
	yearEnd?: number;
	cityCodeOri?: number;
	cityCodeDes: number;
	transportMode: number;
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
	| 'heightRatio'
	| 'intrudedHeightRatio'
	| 'coneStep'
	| 'referenceEquiRectangular'
	| 'pointsPerCurve'
	| 'THREE_EARTH_RADIUS'
	| 'projectionBegin'
	| 'projectionEnd'
	| 'projectionPercent'
	| 'year'
	| 'tick';

export type configurationCallback = (name: configurationObservableEvt, value: unknown) => void;
export type ShaderTypes = 'fragment' | 'vertex';
/**
 * [[ILookupCurvesAndCityGraph]] contains
 * * [[ILookupCityGraph]] network data (graph data) with modes and speed parameters
 * * [[curvesData]] curves data for geometric processes
 *
 * (some duplication but the purposes are different)
 */
export interface ILookupCurvesAndCityGraph {
	lookupCityNetwork: ILookupCityGraph;
	curvesData: ILookupCurves;
}
/**
 * Defines the city at the other extremity of an edge
 */
export interface ICityExtremityOfEdge {
	cityCode: string | number;
	position: Cartographic;
}
/**
 * Curve data associated to an edge from a given city
 *
 * [[pointP]] and [[pointQ]] are control points for Bezier curves
 *
 * [[theta]] is the angle between cities
 */
export interface ILookupCurveList {
	end: ICityExtremityOfEdge;
	pointP: Cartographic;
	pointQ: Cartographic;
	middle: Cartographic;
	speedRatio: { [transportName: string]: { [year: string]: number } };
	theta: number;
}
/**
 * Curves from a city
 */
export interface ILookupCurvesFromCity {
	begin: ICityExtremityOfEdge;
	list: { [cityCodeEnd: string]: ILookupCurveList };
}
/**
 * A curve and its associated graph edge has a [[cityCodeBegin]]
 *
 * other parameters of this curve derive from the [[ILookupCurveItem]]
 */
export interface ILookupCurves {
	[cityCodeBegin: number]: ILookupCurvesFromCity;
}
export interface IMarkLimits {
	begin: number; // Inclusif
	end: number; // Exclusif
}
export interface IListFile {
	name: string;
	text: string;
}
