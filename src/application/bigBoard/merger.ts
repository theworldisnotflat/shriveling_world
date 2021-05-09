/**
 * In merger we put the functions used only once
 * which are CPU/GPU intensive functions
 * and which compute the geometry of cones and edges.
 * The functions that must run each time a parameter is modified
 * are located in the respective files for cones and edges
 *
 * The general architecture of the project is:
 * * merger with computing intensive functions used once
 * * shaders with functions fast to execute in interaction with the user
 * * display conversions where final computation occurs, including geographical projections
 *
 * The merger function itself realise a connection between data
 * read in csv files in a manner similar to a database
 * so that the project can easily access any part of the input data
 *
 */
'use strict';
import Papa from 'papaparse';
import { NEDLocal } from '../common/referential';
import { interpolator, LatLonH, reviver } from '../common/utils';
import type {
	ITranspMode,
	ICity,
	IEdge,
	ILookupCityGraph,
	IMergerState,
	ILookupDestWithModes,
	IPopulation,
	ITransportModeSpeed,
	ILookupCurvesAndCityGraph,
	ILookupCurves,
	ICityExtremityOfEdge,
	ILookupCurveList,
	ILookupConeAngles,
} from '../definitions/project';
import { CONFIGURATION } from '../common/configuration';
import * as FileSaver from 'file-saver';
import { ConeAndCurveBoard } from '../cone/coneBoard';

interface ICodeSpeedPerYear {
	[code: string]: {
		speed: number;
		alpha?: number;
	};
}
let codeSpeedPerYear: ICodeSpeedPerYear = {};
/**
 * Realizes the merge of two tables base on an attribute. The key for the merge is renamed.
 * At the end of the process the recipient table is enriched.
 *
 * @param mother the recipient table
 * @param girl where additional data lies
 * @param motherProperty the mother attribute on which merge is realized
 * @param girlProperty   the girl   attribute on which merge is realized
 * @param newName name of the resulting attribute
 * @param forceArray forces attribute to being a table
 * @param girlPropertyToRemove
 * @param motherPropertyToRemove
 */
function merger<U, V>(
	mother: U[],
	girl: V[],
	motherProperty: string,
	girlProperty: string,
	newName: string,
	forceArray: boolean,
	girlPropertyToRemove: boolean,
	motherPropertyToRemove: boolean
): void {
	let subGirl: V;
	let subMother: U;
	let attribute: string;
	const lookupGirl: { [x: string]: V | V[] } = {};
	let lessThanOne = !forceArray;
	for (const element of girl) {
		subGirl = element;
		if (
			subGirl.hasOwnProperty(girlProperty) &&
			subGirl[girlProperty] !== undefined &&
			subGirl[girlProperty] !== null
		) {
			attribute = subGirl[girlProperty].toString();
			if (girlPropertyToRemove) {
				delete subGirl[girlProperty];
			}

			if (Array.isArray(lookupGirl[attribute])) {
				(<V[]>lookupGirl[attribute]).push(subGirl);
				lessThanOne = false;
			} else {
				lookupGirl[attribute] = [subGirl];
			}
		}
	}

	if (lessThanOne) {
		for (attribute in lookupGirl) {
			if (lookupGirl.hasOwnProperty(attribute)) {
				lookupGirl[attribute] = lookupGirl[attribute][0];
			}
		}
	}

	for (const element of mother) {
		subMother = element;
		subMother[newName] = [];
		attribute = subMother[motherProperty];
		if (attribute !== undefined && attribute !== null) {
			attribute = attribute.toString();
			if (lookupGirl.hasOwnProperty(attribute)) {
				subMother[newName] = lookupGirl[attribute];
			}
		}

		if (motherPropertyToRemove) {
			delete subMother[motherProperty];
		}
	}
}

/**
 * data files are identified by testing the
 * headings read in the file with these
 * 'hard coded' headings
 */
const hardCodedHeadings: Array<{ fileName: string; headings: string[] }> = [
	{ fileName: '_cities', headings: ['cityCode', 'latitude', 'longitude'] },
	{ fileName: '_transportModeSpeeds', headings: ['transportModeCode', 'year', 'speedKPH'] },
	{ fileName: '_transportModes', headings: ['code', 'name', 'terrestrial'] },
	{ fileName: '_transportNetwork', headings: ['transportModeCode', 'cityCodeDes', 'cityCodeOri'] },
	{ fileName: '_populations', headings: ['cityCode'] },
];

/**
 * "thetaThreshold" = threshold angle of the modelled air services speed.
 * The threshold length is fixed at 2000 km for the current (2010) air system
 * * beyond "thetaThreshold" speed has the constant value "speed"
 * * below "thetaThreshold" speed decreases from value "speed" to zero depending on the value of "theta"
 */
let distCrowThreshold = 2000;
let thetaThreshold = distCrowThreshold / (CONFIGURATION.earthRadiusMeters / 1000);
let _maxDistCrowAerial = 0;
let _firstYear = 2000;
let _lastYear = 1900;
let roadCode: number;
let _transportName: { curves: string[]; cones: string[] } = { curves: [], cones: [] };
const config: Papa.ParseConfig = {
	header: true,
	dynamicTyping: true,
	skipEmptyLines: true,
	fastMode: true,
};

/**
 * Gets the CSV file, parses it,
 * and returns a table
 *
 * @param  text
 * @param [isTransportModeCode=false]
 * @returns {*}
 */
function getCSV(text: string, isTransportModeCode = false): any {
	config.transform = undefined;
	if (isTransportModeCode) {
		config.transform = (value, field) => {
			if (field === 'terrestrial') {
				value = value === '1' ? 'true' : 'false';
			}

			return value;
		};
	}

	return Papa.parse(text, config).data;
}

/**
 * Gets the middle between two LatLonH positions :
 * [[posA]] and [[posB]]
 *
 * @param {LatLonH} posA
 * @param {LatLonH} posB
 * @returns {{ middle: LatLonH, theta: number }}
 */
function getMidPointAndTheta(posA: LatLonH, posB: LatLonH): { middle: LatLonH; theta: number } {
	const theta = posA.exactDistance(posB);
	const deltaLambda = posB.longitude - posA.longitude;
	const cosPhi2 = Math.cos(posB.latitude);
	const sinPhi2 = Math.sin(posB.latitude);
	const cosPhi1 = Math.cos(posA.latitude);
	const sinPhi1 = Math.sin(posA.latitude);
	const bx = cosPhi2 * Math.cos(deltaLambda);
	const by = cosPhi2 * Math.sin(deltaLambda);
	const result = new LatLonH();
	result.latitude = Math.atan2(sinPhi1 + sinPhi2, Math.sqrt((cosPhi1 + bx) * (cosPhi1 + bx) + by * by));
	result.longitude = posA.longitude + Math.atan2(by, cosPhi1 + bx);
	return { middle: result, theta };
}

/**
 * [[getModelledSpeed]] computes a new speed for aerial ([[terrestrial]] = false)
 * links having a length less than distCrowThreshold, implying
 * a [[theta]] < [[thetaThreshold]]
 * this modelled speed will be lower than the considered mode speed
 *
 * [[theta]] is the angle between the two cities
 * in the un-projected situation
 *
 * In the case of air links, two equations are used to determine
 * the [height of aerial links above the geodesic](http://bit.ly/2H4FOKw):
 * * below the threshold limit:![below](http://bit.ly/2Xu3kGF)
 * * beyond the threshold limit: ![beyond](http://bit.ly/2EejFpW)
 * * the figure: ![2](http://bit.ly/2H4FOKw)
 * The threshold is taken at 2000 km, based on ![an analysis of
 * current (2010) OD pairs of flight ](http://bit.ly/2OiEFC4)
 *
 * [More detailed explanations here](https://timespace.hypotheses.org/121)
 *
 * @param theta
 * @param speedMax
 * @param transpModeSpeed
 * @param terrestrial
 */
function getModelledSpeed(theta: number, transpModeSpeed: number, terrestrial: boolean): number {
	return terrestrial
		? // Usual terrestrial mode situation
		  transpModeSpeed
		: // Aerial case ([[terrestrial]] = false)
		theta < thetaThreshold //case [[theta]] < [[thetaThreshold]]
		? // In the general case  750 kph / 2000 km (factor 0.375)
		  ((CONFIGURATION.earthRadiusMeters / 1000) * theta * transpModeSpeed) / distCrowThreshold
		: transpModeSpeed; // case [[theta]] > [[thetaThreshold]]
}

/**
 * [[networkFromCities]] is the main function of the project
 *
 * function [[networkFromCities]] explores the [[transportNetwork]]
 * around each city in order to
 * * determine the geometry of cones ([[cities]])
 * * and to draw curves
 *
 * First part of the function is putting in cache all the computations
 * needed from each city, and especially  the [[referential]]
 *
 * Second part of the function explores the transport network from each city
 *
 * ![equation 1](http://bit.ly/2tLfehC) equation 1 is on lines 354 and 404
 *
 * ![figure 1](http://bit.ly/2HhgxNg)
 *
 * More about the [geometry of cones](https://timespace.hypotheses.org/121)
 *
 * @param transportModes
 * @param cities
 * @param transpNetwork
 */
function networkFromCities(
	transportModes: ITranspMode[],
	cities: ICity[],
	transpNetwork: IEdge[],
	transportModeSpeed: ITransportModeSpeed[]
): ILookupCurvesAndCityGraph {
	const cityGraph: ILookupCityGraph = {};
	const curvesData: ILookupCurves = {};
	// determining the 'historical time span'
	// const currentYear = new Date().getFullYear();
	let firstYear = -3000;
	let lastYear = 3000;

	/**
	 * [[ISpeedPerYear]] is the table of max speed per [[year]]
	 */
	interface IMaxSpeedPerYear {
		[year: string]: number;
	}
	/**
	 *
	 * association table indicating the maximum available speed on a given year
	 */
	const maxSpeedPerYear: IMaxSpeedPerYear = {};
	/**
	 * [[ITransportCodeItem]] has
	 * * a [[speed]] and
	 * * a [[year]]
	 */
	interface ITransportCodeItem {
		speed: number;
		year: number;
	}
	/**
	 * Associating a speed to an alpha (cone slope)
	 * as in [equation 1](http://bit.ly/2tLfehC)
	 */
	interface ISpeedAlpha {
		speed: number;
		alpha?: number;
	}
	/**
	 * Interface of a transport mode with table od speed
	 */
	interface ITabSpeedPerTranspModePerYear {
		tabSpeedPerYear: { [year: string]: ISpeedAlpha };
		name: string;
		terrestrial: boolean;
	}
	/**
	 * [[ILookupCacheAnchorsEdgeCone]] describes:
	 * * an edge with an end (optional) middle, pointP
	 *   at 1/4 anf pointQ at 3/4, as anchor points
	 * * description of the cone with
	 *   theta the angle between the two cities
	 *   and clock the unit triangle tha generates the cone
	 */
	interface ILookupCacheAnchorsEdgeCone {
		end?: ICityExtremityOfEdge;
		pointP: LatLonH;
		pointQ: LatLonH;
		middle: LatLonH;
		theta: number;
		clock: number;
	}
	_transportName = { curves: [], cones: [] };
	/**
	 * association table linking a transport mode to an object of type [[ITabSpeedPerYearPerTranspModeItem]]
	 */
	const speedPerTranspModePerYear: { [transportCode: string]: ITabSpeedPerTranspModePerYear } = {};

	// computing transport mode time span variables
	({ firstYear, lastYear } = historicalTimeSpan(transportModes, transpNetwork, firstYear, lastYear, roadCode));
	/**
	 * For each transport mode:
	 * * we identify the 'Road' mode
	 * * we determine if it is terrestrial (cones) or not (curve)
	 * * the temporal scope of the transport mode
	 * * the table of speed of the considered transport modes.
	 * the interpolation function used to populate the table returns
	 * for each year in the temporal scope an interpolated speed between
	 * the two dates when the speed is known
	 *
	 * Attention: dataset MUST contain a mode named 'Road' that will define the slope of cones
	 * cones is the geographic surface and the 'Road' speed is attached to this surface
	 *
	 * At the end of this loop [[speedPerTransportPerYear]] and [[maximumSpeed]] are populated
	 */
	transportModes.forEach((transpMode) => {
		const transportCode = transpMode.code;
		const modeName = transpMode.name;

		_transportName[transpMode.terrestrial ? 'cones' : 'curves'].push(modeName);
		const minYearTransport = transpMode.yearBegin;
		const maxYearTransport = transpMode.yearEnd;
		let tempTransportCodeTab: ITransportCodeItem[] = [];
		const tabSpeedPerYear: { [year: string]: ISpeedAlpha } = {};
		transpMode.speedTab.forEach((transportSpeed) => {
			tempTransportCodeTab.push({ speed: transportSpeed.speedKPH, year: transportSpeed.year });
		});
		tempTransportCodeTab = tempTransportCodeTab.sort((a, b) => a.year - b.year);
		const interpolation = interpolator(tempTransportCodeTab, 'year', 'speed', false); // Boolean at false to interpolate beyond limits!
		let speed: number;
		for (let year = minYearTransport; year <= maxYearTransport; year++) {
			speed = interpolation(year);
			tabSpeedPerYear[year] = { speed };
			if (maxSpeedPerYear.hasOwnProperty(year)) {
				if (maxSpeedPerYear[year] < speed) {
					maxSpeedPerYear[year] = speed;
				}
			} else {
				maxSpeedPerYear[year] = speed;
			}
		}
		speedPerTranspModePerYear[transportCode] = {
			tabSpeedPerYear: tabSpeedPerYear,
			name: modeName,
			terrestrial: transpMode.terrestrial,
		};
	});
	console.log('speedPerTranspModePerYear', speedPerTranspModePerYear, 'maxSpeedPerYear', maxSpeedPerYear);
	_firstYear = firstYear;
	_lastYear = lastYear;
	// for each transport mode, for each year determine [alpha]
	// using maximumSpeed and mode Speed based on [equation 1](http://bit.ly/2tLfehC)
	for (const transportCode in speedPerTranspModePerYear) {
		const tabSpeedPerYear = speedPerTranspModePerYear[transportCode].tabSpeedPerYear;
		for (const year in tabSpeedPerYear) {
			if (maxSpeedPerYear.hasOwnProperty(year)) {
				const maxSpeed = maxSpeedPerYear[year];
				const speedAmb = tabSpeedPerYear[year].speed;
				let alpha = Math.atan(Math.sqrt((maxSpeed / speedAmb) * (maxSpeed / speedAmb) - 1));
				if (alpha < 0) {
					alpha += CONFIGURATION.TWO_PI;
				}

				tabSpeedPerYear[year].alpha = alpha;
			}
		}
	}
	// Faire lookup des latLonH/referential par cityCode. OK
	const lookupPosition: { [cityCode: string]: NEDLocal } = {};
	const lookupMiddle: { [cityCodeBegin: number]: { [cityCodeEnd: number]: ILookupCacheAnchorsEdgeCone } } = {};
	cities.forEach((city) => {
		const position = new LatLonH(city.longitude, city.latitude, 0, false);
		lookupPosition[city.cityCode] = new NEDLocal(position);
	});
	// tab of mode speeds used in legend
	codeSpeedPerYear = {};
	Object.keys(speedPerTranspModePerYear).forEach((key) => {
		Object.keys(speedPerTranspModePerYear[key].tabSpeedPerYear).forEach((elem) => {
			if (elem == CONFIGURATION.year) {
				const speed = speedPerTranspModePerYear[key].tabSpeedPerYear[CONFIGURATION.year].speed;
				const alpha = speedPerTranspModePerYear[key].tabSpeedPerYear[CONFIGURATION.year].alpha;
				codeSpeedPerYear[speedPerTranspModePerYear[key].name] = { speed, alpha };
			}
		});
	});
	console.log('Info for the legend: ', codeSpeedPerYear);
	/**
	 *
	 * Function putting in cache the unit triangles (clock) of the cone
	 * the computation of angles and anchor points
	 * of edges between cities (the order of cities has no importance)
	 *
	 * @param  begin starting city code
	 * @param  end   ending   city code
	 * @return returns the result of the computation with the two cities as input
	 * (opening theta, points P Q and midpoint)
	 */
	function cachedGetBezierPointsThetaAndClock(begin: number, end: number): ILookupCacheAnchorsEdgeCone {
		const result = <ILookupCacheAnchorsEdgeCone>{};
		result.end = { cityCode: end, position: lookupPosition[end].latLonHRef };
		if (lookupMiddle.hasOwnProperty(begin)) {
			if (!lookupMiddle[begin].hasOwnProperty(end)) {
				const { middle, theta } = getMidPointAndTheta(
					lookupPosition[begin].latLonHRef,
					lookupPosition[end].latLonHRef
				);
				const pointP = getMidPointAndTheta(lookupPosition[begin].latLonHRef, middle).middle;
				const pointQ = getMidPointAndTheta(middle, lookupPosition[end].latLonHRef).middle;
				let clock = lookupPosition[begin].getClock(lookupPosition[end].latLonHRef);
				lookupMiddle[begin][end] = { pointP, pointQ, middle, theta, clock };
				if (!lookupMiddle.hasOwnProperty(end)) {
					lookupMiddle[end] = {};
				}

				clock = lookupPosition[end].getClock(lookupPosition[begin].latLonHRef);
				lookupMiddle[end][begin] = { pointP: pointQ, pointQ: pointP, middle, theta, clock };
			}
		} else {
			const { middle, theta } = getMidPointAndTheta(
				lookupPosition[begin].latLonHRef,
				lookupPosition[end].latLonHRef
			);
			const pointP = getMidPointAndTheta(lookupPosition[begin].latLonHRef, middle).middle;
			const pointQ = getMidPointAndTheta(middle, lookupPosition[end].latLonHRef).middle;
			let clock = lookupPosition[begin].getClock(lookupPosition[end].latLonHRef);
			lookupMiddle[begin] = {};
			lookupMiddle[begin][end] = { pointP, pointQ, middle, theta, clock };
			if (!lookupMiddle.hasOwnProperty(end)) {
				lookupMiddle[end] = {};
			}

			clock = lookupPosition[end].getClock(lookupPosition[begin].latLonHRef);
			lookupMiddle[end][begin] = { pointP: pointQ, pointQ: pointP, middle, theta, clock };
		}

		const cached = lookupMiddle[begin][end];
		result.middle = cached.middle;
		result.theta = cached.theta;
		result.pointQ = cached.pointQ;
		result.pointP = cached.pointP;
		result.clock = cached.clock;
		return result;
	}

	// ProcessedODs will contain the value of edgeTranspModeName for each existing edge (OD)
	// processedODs avoids duplicating edges:
	const processedODs: { [begin: string]: { [end: string]: string[] } } = {};
	cities.forEach((city) => {
		const origCityCode = city.cityCode;
		const referential = lookupPosition[origCityCode];
		if (!processedODs.hasOwnProperty(origCityCode)) {
			processedODs[origCityCode] = {}; // Creates an empty property for 'origCityCode'
		}

		if (referential instanceof NEDLocal) {
			const startPoint: ICityExtremityOfEdge = { cityCode: origCityCode, position: referential.latLonHRef };
			/**
			 *  List of curves from the considered city (described by their destination cities)
			 * */
			const listOfCurves: { [cityCodeEnd: string]: ILookupCurveList } = {};
			const coneAngles: ILookupConeAngles = {};
			const destinationsWithModes: ILookupDestWithModes = {};
			let destCityCode: number;
			let edge: IEdge;
			let alpha: number; // for complex alpha cones
			let edgeTranspModeName: string;
			let edgeTranspModeSpeed: ITabSpeedPerTranspModePerYear;
			if (city.edges.length === 0) {
				city.edges.push({ eYearBegin: firstYear, cityCodeDes: -Infinity, transportModeCode: roadCode });
			}
			// first step: applying default values to [[coneAngles]],
			// valid even if zero edge connects to the city
			for (let year = firstYear; year <= lastYear; year++) {
				const coneRoadAlpha = speedPerTranspModePerYear[roadCode].tabSpeedPerYear[year].alpha;
				coneAngles[year] = { coneRoadAlpha: coneRoadAlpha, coneFastTerrModeAlpha: null, alphaTab: [] };
			}

			// For each edge incident to the city considered
			for (let i = 0; i < city.edges.length; i++) {
				edge = city.edges[i];
				if (origCityCode == edge.cityCodeOri) {
					destCityCode = edge.cityCodeDes;
				} else {
					destCityCode = edge.cityCodeOri;
				}
				// EdgeTranspModeSpeed is the key parameter of the process
				// it will be confronted to maximumSpeed[year]
				edgeTranspModeSpeed = speedPerTranspModePerYear[edge.transportModeCode];
				// Prepare tables
				if (!processedODs.hasOwnProperty(destCityCode)) {
					processedODs[destCityCode] = {};
				}

				if (!processedODs[origCityCode].hasOwnProperty(destCityCode)) {
					processedODs[origCityCode][destCityCode] = []; // O-d edge
					processedODs[destCityCode][origCityCode] = []; // D-o edge to avoid
				}
				if (lookupPosition.hasOwnProperty(destCityCode)) {
					// computing the geometry of the curve
					const { end, middle, theta, pointP, pointQ, clock } = cachedGetBezierPointsThetaAndClock(
						origCityCode,
						destCityCode
					);
					edgeTranspModeName = edgeTranspModeSpeed.name;
					// Prepare tables
					if (!destinationsWithModes.hasOwnProperty(destCityCode)) {
						destinationsWithModes[destCityCode] = {};
					}

					if (!destinationsWithModes[destCityCode].hasOwnProperty(edgeTranspModeName)) {
						destinationsWithModes[destCityCode][edgeTranspModeName] = [];
					}

					const edgeModeSpeed = edgeTranspModeSpeed.tabSpeedPerYear;
					const edgeToBeProcessed = !processedODs[origCityCode][destCityCode].includes(edgeTranspModeName);
					processedODs[origCityCode][destCityCode].push(edgeTranspModeName);
					processedODs[destCityCode][origCityCode].push(edgeTranspModeName);
					// For each year in the time span the cone angles will be retrieved
					for (let year = firstYear; year <= lastYear; year++) {
						// condition if [[edgeTranspModeSpeed.tabSpeedPerYear[year]]] is defined
						if (edgeTranspModeSpeed.tabSpeedPerYear[year]) {
							if (edgeTranspModeSpeed.terrestrial) {
								const coneRoadAlpha = speedPerTranspModePerYear[roadCode].tabSpeedPerYear[year].alpha;
								const coneFastTerrModeAlpha =
									speedPerTranspModePerYear[edge.transportModeCode].tabSpeedPerYear[year].alpha;
								coneAngles[year] = {
									coneRoadAlpha: coneRoadAlpha,
									coneFastTerrModeAlpha: coneFastTerrModeAlpha,
									alphaTab: [],
								};

								alpha = edgeTranspModeSpeed.tabSpeedPerYear[year].alpha;
								// here we add the couple (alpha, clock) for the terrestrial edge
								coneAngles[year].alphaTab.push({ alpha, clock });
								destinationsWithModes[destCityCode][edgeTranspModeName].push({
									year,
									speed: edgeModeSpeed[year].speed,
								});
								if (edgeToBeProcessed) {
									// Condition to avoid visual duplication of curves!
									const modelledSpeed = getModelledSpeed(
										theta,
										edgeModeSpeed[year].speed,
										edgeTranspModeSpeed.terrestrial
									);
									// The ratio linking the current speed and maxSpeed is
									// computed according to this ![equation](http://bit.ly/2EejFpW)
									const speedRatio = (maxSpeedPerYear[year] * theta) / (2 * modelledSpeed);
									if (!listOfCurves.hasOwnProperty(destCityCode)) {
										listOfCurves[destCityCode] = <ILookupCurveList>{
											end,
											middle,
											pointP,
											pointQ,
											theta,
											speedRatio: {},
										};
									}

									if (!listOfCurves[destCityCode].speedRatio.hasOwnProperty(edgeTranspModeName)) {
										listOfCurves[destCityCode].speedRatio[edgeTranspModeName] = {};
									}

									listOfCurves[destCityCode].speedRatio[edgeTranspModeName][year] = speedRatio;
								}
							} else if (edgeToBeProcessed) {
								// Case when edge transport mode is not terrestrial
								// we will generate a curve for the edge
								// condition to avoid duplicating curves
								const modelledSpeed = getModelledSpeed(
									theta,
									edgeModeSpeed[year].speed,
									edgeTranspModeSpeed.terrestrial
								);
								// The ratio linking the current speed and maxSpeed is
								// computed according to this ![equation](http://bit.ly/2EejFpW)
								const speedRatio = (maxSpeedPerYear[year] * theta) / (2 * modelledSpeed);
								if (!listOfCurves.hasOwnProperty(destCityCode)) {
									listOfCurves[destCityCode] = <ILookupCurveList>{
										end,
										middle,
										pointP,
										pointQ,
										theta,
										speedRatio: {},
									};
								}

								if (!listOfCurves[destCityCode].speedRatio.hasOwnProperty(edgeTranspModeName)) {
									listOfCurves[destCityCode].speedRatio[edgeTranspModeName] = {};
								}

								listOfCurves[destCityCode].speedRatio[edgeTranspModeName][year] = speedRatio;
							}
						} else {
							continue;
						}
					}
				}
			}
			// At this stage all cities have been processed
			// It is necessary to re-order the table of clocks to generate the complex cones
			// and inserting the result in network and insert the edgeData
			for (const year in coneAngles) {
				if (coneAngles.hasOwnProperty(year)) {
					coneAngles[year].alphaTab = coneAngles[year].alphaTab.sort((a, b) => a.clock - b.clock);
				}
			}

			cityGraph[origCityCode] = {
				referential,
				cone: coneAngles,
				destinationsWithModes,
				origCityProperties: city,
			};
			if (Object.keys(listOfCurves).length > 0) {
				// Retrieves edges info from origCityCode for curves generation
				curvesData[origCityCode] = { begin: startPoint, list: listOfCurves };
			}
		}
	});
	return { lookupCityGraph: cityGraph, curvesData };
}

/**
 * The class [[Merger]] will
 * * introduce the data into tables
 *   * [[_cities]],
 *   * [[_populations]],
 *   * [[_transportModeSpeed]],
 *   * [[_transportMode]],
 *   * [[_transportNetwork]],
 *   * [[_state]] and
 *   * [[_linksAndTranspModes]]
 *
 * This class will contain the function [[merge]]
 */
export class Merger {
	private _cities: ICity[] = [];
	private _populations: IPopulation[] = [];
	private _transportModeSpeeds: ITransportModeSpeed[] = [];
	private _transportModes: ITranspMode[] = [];
	private _transportNetwork: IEdge[] = [];
	private _state: IMergerState = 'missing';
	private _curvesAndCityGraph: ILookupCurvesAndCityGraph = <ILookupCurvesAndCityGraph>{};

	public get state(): IMergerState {
		return this._state;
	}

	/**
	 * This is the resulting subgraph processed by function [[networkFromCities]]
	 * in order to give access to the relevant data inside bigBoard
	 */
	public get edgesWithTranspModes(): ILookupCurvesAndCityGraph {
		return this._curvesAndCityGraph;
	}

	public get Cities(): ICity[] {
		return this._cities;
	}

	public CitiesByIndex(index: string | number): ICity {
		return this._cities[index];
	}

	public get conesAndCurvesData(): ILookupCurvesAndCityGraph {
		return this._curvesAndCityGraph;
	}

	public get firstYear(): number {
		return _firstYear;
	}

	public get lastYear(): number {
		return _lastYear;
	}

	public get transportNames(): { curves: string[]; cones: string[] } {
		return _transportName;
	}

	public get codeSpeedPerYear(): ICodeSpeedPerYear {
		return codeSpeedPerYear;
	}

	public get maxDistCrowAerial(): number {
		return _maxDistCrowAerial;
	}

	public clear(): void {
		this._cities = [];
		this._populations = [];
		this._transportModeSpeeds = [];
		this._transportModes = [];
		this._transportNetwork = [];
		this._curvesAndCityGraph = <ILookupCurvesAndCityGraph>{};
		this._state = 'missing';
	}

	/**
	 * Connects a file read in the dataset folder
	 * with the relevant data structures of the code.
	 * A file type is identified through its headings:
	 * the headings read are compared to a hard coded headings list
	 * Once data file type is identified, the parser
	 * is called with function [[getCSV]]
	 * @param readString
	 */
	public addFile(readString: string): void {
		const readRows = readString.split(/\r\n|\r|\n/);
		const readHeadings = readRows[0];
		let dataFileType: string;
		let codedHeadings: string[];
		let ok: boolean;
		for (let i = 0; i < hardCodedHeadings.length && dataFileType === undefined; i++) {
			codedHeadings = hardCodedHeadings[i].headings;
			ok = true;
			for (let j = 0; j < codedHeadings.length && ok; j++) {
				if (!readHeadings.includes(codedHeadings[j])) {
					ok = false;
				}
			}
			if (ok) {
				dataFileType = hardCodedHeadings[i].fileName;
			}
		}
		if (dataFileType === undefined) {
			throw new Error('scheme unknown');
		} else {
			this[dataFileType] = [];
			this[dataFileType].push(...getCSV(readString, dataFileType === '_transportMode'));
			if (dataFileType === '_transportMode' || dataFileType === '_transportNetwork') {
				(this[dataFileType] as IEdge[]).forEach((item) => {
					if (item.eYearEnd === undefined || item.eYearEnd === null || item.eYearEnd.toString() === '') {
						delete item.eYearEnd;
					}
				});
			}

			this._checkState();
		}
	}

	/**
	 * The function [[merge]] will
	 * * retrieve all data from csv files
	 * * introduce the data into tables:
	 *   * [[cities]],
	 *   * [[population]],
	 *   * [[transportModeSpeeds]],
	 *   * [[transportModes]],
	 *   * [[transportNetwork]],
	 *   * [[_state]]
	 * * link all these tables to each other
	 * * execute the main process i.e. [[networkFromCities]]
	 * * retrieve the resulting data into [[_edgesAndTranspModes]]
	 */
	public merge(generateTraveTimeMatrix?: boolean, matrixName?: string): void {
		if (this._state === 'ready' || this._state === 'complete') {
			let startIndexRoadCrowFlyEdges = undefined;
			this._state = 'pending';
			// Csv parsing into tables
			const cities: ICity[] = JSON.parse(JSON.stringify(this._cities), reviver);
			const population: IPopulation[] = JSON.parse(JSON.stringify(this._populations), reviver);
			const transportModes: ITranspMode[] = JSON.parse(JSON.stringify(this._transportModes), reviver);
			const transportModeSpeeds: ITransportModeSpeed[] = JSON.parse(
				JSON.stringify(this._transportModeSpeeds),
				reviver
			);
			const transportNetwork: IEdge[] = JSON.parse(JSON.stringify(this._transportNetwork), reviver);

			// Linking tables to each other
			// merger(mother,     girl,               motherProp., girlProp.,      newName, forceArray, removeMotherProp., removeGirlProp.)
			merger(transportModes, transportModeSpeeds, 'code', 'transportModeCode', 'speedTab', true, true, false);
			// identifying Road in the dataset
			roadCode = identifyingRoadMode(transportModes);
			merger(cities, population, 'cityCode', 'cityCode', 'populations', false, true, false);
			if (generateTraveTimeMatrix) {
				//generate all straight line trips by road between cities (for travel time matrix)
				console.log(transportNetwork.length);
				startIndexRoadCrowFlyEdges = transportNetwork.length + 1;
				this.generateRoadCrowFlyEdges(cities, transportNetwork);
			}
			// Attach city information to starting and ending city edge
			merger(transportNetwork, cities, 'cityCodeOri', 'cityCode', 'origCityInfo', false, false, false);
			merger(transportNetwork, cities, 'cityCodeDes', 'cityCode', 'destCityInfo', false, false, false);
			// cleaning up transportNetwork = remove edges with one or zero extremities in the 'cities' list
			this.cleanUpNetwork(transportNetwork, cities);
			// Generates subgraph from city considered as origin and as destination
			merger(cities, transportNetwork, 'cityCode', 'cityCodeOri', 'outEdges', true, false, false);
			merger(cities, transportNetwork, 'cityCode', 'cityCodeDes', 'inEdges', true, false, false);
			// merging in and out into edges, remove in and out
			cities.forEach((city) => {
				city.edges = [...city.inEdges, ...city.outEdges];
				delete city.inEdges;
				delete city.outEdges;
			});
			// retrieve maxDistCrowAerial in km for connected edges
			transportNetwork.forEach((edge) => {
				const cityOri: ICity = cities.find((c) => c.cityCode === edge.cityCodeOri);
				const cityDes: ICity = cities.find((c) => c.cityCode === edge.cityCodeDes);
				if (!(cityOri === undefined || cityDes === undefined)) {
					edge.distCrowKM =
						haversine(cityOri.latitude, cityOri.longitude, cityDes.latitude, cityDes.longitude) / 1000;
					const tMode: ITranspMode = transportModes.find((t) => t.code === edge.transportModeCode);
					if (!tMode.terrestrial) {
						//aerial mode only
						if (_maxDistCrowAerial < edge.distCrowKM) {
							_maxDistCrowAerial = edge.distCrowKM;
						}
					}
				}
			});
			// for cases of countries of less than 2000 km length
			if (_maxDistCrowAerial < distCrowThreshold) {
				distCrowThreshold = _maxDistCrowAerial;
				thetaThreshold = distCrowThreshold / (CONFIGURATION.earthRadiusMeters / 1000);
			}

			// adjusting the height of cones based on the size or the area
			let diameterKm = 0;
			cities.forEach((cityA) => {
				cities.forEach((cityB) => {
					const crowKm = haversine(cityA.latitude, cityA.longitude, cityB.latitude, cityB.longitude) / 1000;
					if (crowKm > diameterKm) {
						diameterKm = crowKm;
					}
				});
			});
			CONFIGURATION.intrudedHeightRatio = Math.min(
				0.99,
				(1.5 * diameterKm) / (CONFIGURATION.earthRadiusMeters / 1000)
			);

			// The main function that generates geometries (cones, curves) by exploring the subgraphs from cities
			this._curvesAndCityGraph = networkFromCities(transportModes, cities, transportNetwork, transportModeSpeeds);
			// for input data reading debugging
			console.log('curves & cityGraph', this._curvesAndCityGraph);

			if (generateTraveTimeMatrix) {
				// generate travel time matrix with Dijkstra algorithm
				const ttMat = new Array(cities.length + 1).fill(0).map(() => new Array(cities.length + 1).fill(0));
				// ttMat headings
				cities.forEach((city) => {
					ttMat[0][cities.indexOf(city) + 1] = city.cityName;
					ttMat[cities.indexOf(city) + 1][0] = city.cityName;
				});
				const Q: ICity[] = [];
				// populate distCrowKM for existing edges
				transportNetwork.forEach((edge) => {
					const cityOri: ICity = cities.find((c) => c.cityCode === edge.cityCodeOri);
					const cityDes: ICity = cities.find((c) => c.cityCode === edge.cityCodeDes);
					edge.distCrowKM =
						haversine(cityOri.latitude, cityOri.longitude, cityDes.latitude, cityDes.longitude) / 1000;
				});
				// TODO: use year as function parameter
				cities.forEach((source) => {
					cities.forEach((city) => {
						city.timeDist = Infinity;
						city.prev = undefined;
						Q.push(city);
					});
					source.timeDist = 0;
					while (Q.length > 0) {
						const miniCity: ICity = Q.reduce((a, b) => (a.timeDist < b.timeDist ? a : b));
						const miniCityDist = miniCity.timeDist;
						const minCity: ICity = cities.find((c) => c === miniCity);
						Q.splice(Q.indexOf(miniCity), 1);
						minCity.edges.forEach((edge) => {
							//need to consider the direction of the edge
							const cityOri = cities.find((c) => c.cityCode === edge.cityCodeOri);
							const cityDes = cities.find((c) => c.cityCode === edge.cityCodeDes);
							let dCity: ICity = undefined;
							let oCity: ICity = undefined;
							if (cityOri === minCity) {
								oCity = cityOri;
								dCity = cityDes;
							} else {
								dCity = cityOri;
								oCity = cityDes;
							}
							if (oCity !== undefined || dCity !== undefined) {
								const transportSpeed = this._transportModeSpeeds.find(
									(t) => t.transportModeCode == edge.transportModeCode && t.year == CONFIGURATION.year
								);
								// zero cost for changing transport mode
								const edgeDuration = edge.distCrowKM / transportSpeed.speedKPH;
								const pathDuration = miniCityDist + edgeDuration;
								if (pathDuration < dCity.timeDist) {
									dCity.timeDist = pathDuration;
									dCity.prev = oCity;
									// convert to minutes
									ttMat[cities.indexOf(source) + 1][cities.indexOf(dCity) + 1] = Math.round(
										pathDuration * 60
									);
								}
							}
						});
					}
				});
				// remove all straight line trips by road between cities generated in the code
				// not fully working :(
				transportNetwork.splice(
					startIndexRoadCrowFlyEdges--,
					transportNetwork.length - startIndexRoadCrowFlyEdges
				);
				const csvContent = 'data:text/csv;charset=utf-8,' + ttMat.map((e) => e.join(',')).join('\n');
				const encodedUri = encodeURI(csvContent);
				FileSaver.saveAs(encodedUri, matrixName + '.csv');
				//window.open(encodedUri);
			}

			this._state = 'missing';
			this._checkState();
		}
	}
	/**
	 * generate all straight line trips (edges) by road between cities
	 * *
	 * @param cities
	 * @param transportNetwork
	 */
	private generateRoadCrowFlyEdges(cities: ICity[], transportNetwork: IEdge[]) {
		cities.forEach((oCity) => {
			cities.forEach((dCity) => {
				// trick for a half matrix
				if (oCity.cityCode > dCity.cityCode) {
					const crowKM = haversine(oCity.latitude, oCity.longitude, dCity.latitude, dCity.longitude) / 1000;
					transportNetwork.push({
						cityCodeOri: oCity.cityCode,
						cityCodeDes: dCity.cityCode,
						transportModeCode: roadCode,
						distCrowKM: crowKM,
					});
				}
			});
		});
	}

	/**
	 * The function [[cleanUpNetwork]] will
	 * remove unconnected [[edges]], id est remove
	 * * [[edges]] with zero extremities in [[cities]] list
	 * * [[edges]] with one  extremity   in [[cities]] list
	 * @param transportNetwork
	 * @param cities
	 */
	private cleanUpNetwork(transportNetwork: IEdge[], cities: ICity[]) {
		for (let i = 0; i < transportNetwork.length; i++) {
			if (
				cities.findIndex((c) => c.cityCode == transportNetwork[i].cityCodeOri) === -1 ||
				cities.findIndex((c) => c.cityCode == transportNetwork[i].cityCodeDes) === -1
			) {
				transportNetwork.splice(i--, 1);
			}
		}
	}

	private _checkState(): void {
		if (this._state !== 'pending') {
			let state: IMergerState = 'missing';
			if (
				this._cities.length > 0 &&
				this._populations.length > 0 &&
				this._transportModeSpeeds.length > 0 &&
				this._transportModes.length > 0 &&
				this._transportNetwork.length > 0
			) {
				state = 'ready';
				if (Object.keys(this._curvesAndCityGraph).length > 0) {
					state = 'complete';
				}
			}

			this._state = state;
		}
	}
}
/**
 * Scanning the table of [[transportMode]]s to identify
 * the road mode, reference of the model
 * @param transportMode
 */
function identifyingRoadMode(transportMode: ITranspMode[]): number {
	let roadModeCode: number = undefined;
	transportMode.forEach((transpMode) => {
		const transportCode = transpMode.code;
		const modeName = transpMode.name;
		if (modeName === 'Road') {
			roadModeCode = transportCode;
		}
	});
	return roadModeCode;
}

/**
 * The function [[haversine]] computes
 * ___great circle distance___ between two location
 * based on lat/lon data
 * @param lat1
 * @param lon1
 * @param lat2
 * @param lon2
 */
function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
	const R = CONFIGURATION.earthRadiusMeters;
	const φ1 = (lat1 * Math.PI) / 180; // φ, λ in radians
	const φ2 = (lat2 * Math.PI) / 180;
	const Δφ = ((lat2 - lat1) * Math.PI) / 180;
	const Δλ = ((lon2 - lon1) * Math.PI) / 180;

	const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

	const d = R * c; // in metres
	return d;
}
/**
 * The function determines the [[historicalTimeSpan]]
 * based on data found in the input files:
 * * [[transportMode]]
 * * [[transpNetwork]]
 * @param transportModes
 * @param transpNetwork
 * @param firstYear
 * @param lastYear
 * @param roadCode
 */
function historicalTimeSpan(
	transportModes: ITranspMode[],
	transpNetwork: IEdge[],
	firstYear: number,
	lastYear: number,
	roadCode: number
) {
	transportModes.forEach((transpMode) => {
		// initializing the variables
		let oneUndefinedEYearBegin = false;
		let oneUndefinedEYearEnd = false;
		// first retrieve dates indicated in the speeds file
		transpMode.minSYear = transpMode.speedTab[0].year;
		transpMode.maxSYear = transpMode.speedTab[0].year;
		transpMode.speedTab.forEach((transpSpeed) => {
			if (transpSpeed.year < transpMode.minSYear) {
				transpMode.minSYear = transpSpeed.year;
			}
			if (transpSpeed.year > transpMode.maxSYear) {
				transpMode.maxSYear = transpSpeed.year;
			}
		});
		// second retrieve dates indicated in the network file
		transpMode.minEYear = null;
		transpMode.maxEYear = null;
		transpNetwork.forEach((edge) => {
			if (edge.transportModeCode === transpMode.code) {
				if (edge.eYearBegin !== undefined) {
					if (transpMode.minEYear === null) {
						transpMode.minEYear = edge.eYearBegin;
					} else {
						if (transpMode.minEYear > edge.eYearBegin) {
							transpMode.minEYear = edge.eYearBegin;
						}
					}
				} else {
					oneUndefinedEYearBegin = true;
				}
				if (edge.eYearEnd !== undefined) {
					if (transpMode.maxEYear === null) {
						transpMode.maxEYear = edge.eYearEnd;
					} else {
						if (transpMode.maxEYear < edge.eYearEnd) {
							transpMode.maxEYear = edge.eYearEnd;
						}
					}
				} else {
					oneUndefinedEYearEnd = true;
				}
			}
		});
		if (oneUndefinedEYearBegin) {
			transpMode.minEYear = null;
		}
		if (oneUndefinedEYearEnd) {
			transpMode.maxEYear = null;
		}
	});

	// computing the valid time span of transport modes considering:
	// range of operation AND available speed data
	transportModes.forEach((transpMode) => {
		transpMode.yearBegin = Math.max(
			transpMode.minSYear === null ? -Infinity : transpMode.minSYear,
			transpMode.minEYear === null ? -Infinity : transpMode.minEYear
		);
		transpMode.yearEnd = Math.min(
			transpMode.maxSYear === null ? Infinity : transpMode.maxSYear,
			transpMode.maxEYear === null ? Infinity : transpMode.maxEYear
		);
	});

	// computing the historical time span of the model
	// at this step time span = span of non Road modes
	firstYear = Infinity;
	lastYear = -Infinity;
	transportModes.forEach((transpMode) => {
		if (transpMode.code !== roadCode) {
			if (transpMode.yearBegin < firstYear) firstYear = transpMode.yearBegin;
			if (transpMode.yearEnd > lastYear) lastYear = transpMode.yearEnd;
		}
	});

	// unlikely case when road times are not consistent
	transportModes.forEach((transpMode) => {
		if (transpMode.code === roadCode) {
			if (transpMode.yearBegin > firstYear) firstYear = transpMode.yearBegin;
			if (transpMode.yearEnd < lastYear) lastYear = transpMode.yearEnd;
		}
	});
	console.log('Dataset time span: ', firstYear, lastYear, transportModes);
	return { firstYear, lastYear };
}
