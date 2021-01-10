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
import { interpolator, Cartographic, reviver } from '../common/utils';
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
	ILookupComplexAlpha,
} from '../definitions/project';
import { CONFIGURATION } from '../common/configuration';
import { ConeBoard } from '../cone/coneBoard';
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
	{ fileName: '_cities', headings: ['cityCode', 'latitude', 'longitude', 'radius'] },
	{ fileName: '_transportModeSpeed', headings: ['transportModeCode', 'year', 'speedKPH'] },
	{ fileName: '_transportMode', headings: ['code', 'name', 'terrestrial'] },
	{ fileName: '_transportNetwork', headings: ['transportModeCode', 'cityCodeDes', 'cityCodeOri'] },
	{ fileName: '_populations', headings: ['cityCode'] },
];

/**
 * "thetaLimit" = threshold angle of the modelled air services speed.
 * The threshold length is fixed at 2000 km for the current (2010) air system
 * * beyond "thetaLimit" speed has the constant value "speed"
 * * below "thetaLimit" speed decreases from value "speed" to zero depending on the value of "theta"
 */
const thetaLimit = 2000 / (CONFIGURATION.earthRadiusMeters / 1000);
let _minYear = 2000;
let _maxYear = 1900;
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
 * Gets the middle between two Cartographic positions :
 * [[posA]] and [[posB]]
 *
 * @param {Cartographic} posA
 * @param {Cartographic} posB
 * @returns {{ middle: Cartographic, theta: number }}
 */
function getTheMiddle(posA: Cartographic, posB: Cartographic): { middle: Cartographic; theta: number } {
	const theta = posA.exactDistance(posB);
	const deltaLambda = posB.longitude - posA.longitude;
	const cosPhi2 = Math.cos(posB.latitude);
	const sinPhi2 = Math.sin(posB.latitude);
	const cosPhi1 = Math.cos(posA.latitude);
	const sinPhi1 = Math.sin(posA.latitude);
	const bx = cosPhi2 * Math.cos(deltaLambda);
	const by = cosPhi2 * Math.sin(deltaLambda);
	const result = new Cartographic();
	result.latitude = Math.atan2(sinPhi1 + sinPhi2, Math.sqrt((cosPhi1 + bx) * (cosPhi1 + bx) + by * by));
	result.longitude = posA.longitude + Math.atan2(by, cosPhi1 + bx);
	return { middle: result, theta };
}

/**
 * [[getModelledSpeed]] computes a new speed for aerial links
 * having a length less than [[thetaLimit]]
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
 * @param speed
 * @param terrestrial
 */
function getModelledSpeed(theta: number, speedMax: number, speed: number, terrestrial: boolean): number {
	return terrestrial
		? // Usual terrestrial mode situation
		  speed
		: // Aerial case
		theta < thetaLimit
		? // In the general case 2000 km / 750 kph (factor 0.375)
		  // for Germany based on Hamburg-Munich route 600 km, 1h20 = 450 kph (factor 0.75)
		  // (CONFIGURATION.earthRadiusMeters / 1000) * theta * 0.375 :
		  // ((CONFIGURATION.earthRadiusMeters / 1000) * theta * 450) / 600 :
		  ((CONFIGURATION.earthRadiusMeters / 1000) * theta * 750) / 2000
		: speed;
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
 * @param transportMode
 * @param cities
 * @param transpNetwork
 */
function networkFromCities(
	transportMode: ITranspMode[],
	cities: ICity[],
	transpNetwork: IEdge[],
	transportModeSpeed: ITransportModeSpeed[]
): ILookupCurvesAndCityGraph {
	const network: ILookupCityGraph = {};
	const curvesData: ILookupCurves = {};
	// determining the 'historical time span'
	const currentYear = new Date().getFullYear();
	let minYear = currentYear;
	let maxYear = 0;
	transpNetwork.forEach((item) => {
		if (minYear > item.eYearBegin) {
			minYear = item.eYearBegin;
		}
	});

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
	const maximumSpeed: IMaxSpeedPerYear = {};
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
	interface ITabSpeedPerYearPerTranspModeItem {
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
		pointP: Cartographic;
		pointQ: Cartographic;
		middle: Cartographic;
		theta: number;
		clock: number;
	}
	let roadCode: number;
	_transportName = { curves: [], cones: [] };
	/**
	 * association table linking a transport mode to an object of type [[ITabSpeedPerYearPerTranspModeItem]]
	 */
	const speedPerTransportPerYear: { [transportCode: string]: ITabSpeedPerYearPerTranspModeItem } = {};
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

	// identifying Road in the dataset
	transportMode.forEach((transpMode) => {
		const transportCode = transpMode.code;
		const modeName = transpMode.name;
		if (modeName === 'Road') {
			roadCode = transportCode;
		}
	});

	// computing transport mode time span variables
	transportMode.forEach((transpMode) => {
		// initializing the variables
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
				}
				if (edge.eYearEnd !== undefined) {
					if (transpMode.maxEYear === null) {
						transpMode.maxEYear = edge.eYearEnd;
					} else {
						if (transpMode.maxEYear < edge.eYearEnd) {
							transpMode.maxEYear = edge.eYearEnd;
						}
					}
				}
			}
		});
	});

	// computing the valid time span of transport modes considering:
	// range of operation AND available speed data
	transportMode.forEach((transpMode) => {
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
	minYear = Infinity;
	maxYear = -Infinity;
	transportMode.forEach((transpMode) => {
		if (transpMode.code !== roadCode) {
			if (transpMode.yearBegin < minYear) minYear = transpMode.yearBegin;
			if (transpMode.yearEnd > maxYear) maxYear = transpMode.yearEnd;
		}
	});

	// unlikely case when road times are not consistent
	transportMode.forEach((transpMode) => {
		if (transpMode.code === roadCode) {
			if (transpMode.yearBegin > minYear) minYear = transpMode.yearBegin;
			if (transpMode.yearEnd < maxYear) maxYear = transpMode.yearEnd;
		}
	});
	console.log('time span', minYear, maxYear, transportMode);

	// will compute for each year the maximumSpeed and
	// for each transport mode a table of speed
	transportMode.forEach((transpMode) => {
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
			if (maximumSpeed.hasOwnProperty(year)) {
				if (maximumSpeed[year] < speed) {
					maximumSpeed[year] = speed;
				}
			} else {
				maximumSpeed[year] = speed;
			}
		}

		speedPerTransportPerYear[transportCode] = {
			tabSpeedPerYear: tabSpeedPerYear,
			name: modeName,
			terrestrial: transpMode.terrestrial,
		};
	});
	_minYear = minYear;
	_maxYear = maxYear;

	// for each transport mode, for each year determine [alpha]
	// using maximumSpeed and mode Speed based on [equation 1](http://bit.ly/2tLfehC)
	for (const transportCode in speedPerTransportPerYear) {
		const tabSpedPerYear = speedPerTransportPerYear[transportCode].tabSpeedPerYear;
		for (const year in tabSpedPerYear) {
			if (maximumSpeed.hasOwnProperty(year)) {
				const maxSpeed = maximumSpeed[year];
				const speedAmb = tabSpedPerYear[year].speed;
				let alpha = Math.atan(Math.sqrt((maxSpeed / speedAmb) * (maxSpeed / speedAmb) - 1));
				if (alpha < 0) {
					alpha += CONFIGURATION.TWO_PI;
				}

				tabSpedPerYear[year].alpha = alpha;
			}
		}
	}
	// Faire lookup des cartographic/referential par cityCode. OK
	const lookupPosition: { [cityCode: string]: NEDLocal } = {};
	const lookupMiddle: { [cityCodeBegin: number]: { [cityCodeEnd: number]: ILookupCacheAnchorsEdgeCone } } = {};
	cities.forEach((city) => {
		const position = new Cartographic(city.longitude, city.latitude, 0, false);
		lookupPosition[city.cityCode] = new NEDLocal(position);
	});
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
	function cachedGetTheMiddle(begin: number, end: number): ILookupCacheAnchorsEdgeCone {
		const res = <ILookupCacheAnchorsEdgeCone>{};
		res.end = { cityCode: end, position: lookupPosition[end].cartoRef };
		if (lookupMiddle.hasOwnProperty(begin)) {
			if (!lookupMiddle[begin].hasOwnProperty(end)) {
				const { middle, theta } = getTheMiddle(lookupPosition[begin].cartoRef, lookupPosition[end].cartoRef);
				const pointP = getTheMiddle(lookupPosition[begin].cartoRef, middle).middle;
				const pointQ = getTheMiddle(middle, lookupPosition[end].cartoRef).middle;
				let clock = lookupPosition[begin].getClock(lookupPosition[end].cartoRef);
				lookupMiddle[begin][end] = { pointP, pointQ, middle, theta, clock };
				if (!lookupMiddle.hasOwnProperty(end)) {
					lookupMiddle[end] = {};
				}

				clock = lookupPosition[end].getClock(lookupPosition[begin].cartoRef);
				lookupMiddle[end][begin] = { pointP: pointQ, pointQ: pointP, middle, theta, clock };
			}
		} else {
			const { middle, theta } = getTheMiddle(lookupPosition[begin].cartoRef, lookupPosition[end].cartoRef);
			const pointP = getTheMiddle(lookupPosition[begin].cartoRef, middle).middle;
			const pointQ = getTheMiddle(middle, lookupPosition[end].cartoRef).middle;
			let clock = lookupPosition[begin].getClock(lookupPosition[end].cartoRef);
			lookupMiddle[begin] = {};
			lookupMiddle[begin][end] = { pointP, pointQ, middle, theta, clock };
			if (!lookupMiddle.hasOwnProperty(end)) {
				lookupMiddle[end] = {};
			}

			clock = lookupPosition[end].getClock(lookupPosition[begin].cartoRef);
			lookupMiddle[end][begin] = { pointP: pointQ, pointQ: pointP, middle, theta, clock };
		}

		const cached = lookupMiddle[begin][end];
		res.middle = cached.middle;
		res.theta = cached.theta;
		res.pointQ = cached.pointQ;
		res.pointP = cached.pointP;
		res.clock = cached.clock;
		return res;
	}

	// ProcessedODs will contain the value of edgeTranspModeName for each existing edge (OD)
	// processedODs avoids duplicating edges:
	const processedODs: { [begin: string]: { [end: string]: string[] } } = {};
	// Second part of the function
	// the main loop for each city
	cities.forEach((city) => {
		const origCityCode = city.cityCode;
		const referential = lookupPosition[origCityCode];
		if (!processedODs.hasOwnProperty(origCityCode)) {
			processedODs[origCityCode] = {}; // Creates an empty property for 'origCityCode'
		}

		if (referential instanceof NEDLocal) {
			const startPoint: ICityExtremityOfEdge = { cityCode: origCityCode, position: referential.cartoRef };
			/**
			 *  List of edges from the considered city (described by their destination cities)
			 * */
			const listOfCurves: { [cityCodeEnd: string]: ILookupCurveList } = {};
			// Let coneAlpha: ILookupConeAlpha = {};
			const cone: ILookupComplexAlpha = {};
			const destinationsWithModes: ILookupDestWithModes = {};
			let destCityCode: number;
			let edge: IEdge;
			let alpha: number; // for complex alpha cones
			let edgeTranspModeName: string;
			let edgeTranspModeSpeed: ITabSpeedPerYearPerTranspModeItem;
			if (city.edges.length === 0) {
				city.edges.push({ eYearBegin: minYear, cityCodeDes: -Infinity, transportModeCode: roadCode });
			}

			// For each edge incident to the city considered
			for (let i = 0; i < city.edges.length; i++) {
				edge = city.edges[i];
				destCityCode = edge.cityCodeDes;
				// EdgeTranspModeSpeed is the key parameter of the process
				// it will be confronted to maximumSpeed[year]
				edgeTranspModeSpeed = speedPerTransportPerYear[edge.transportModeCode];
				// Prepare tables
				if (!processedODs.hasOwnProperty(destCityCode)) {
					processedODs[destCityCode] = {};
				}

				if (!processedODs[origCityCode].hasOwnProperty(destCityCode)) {
					processedODs[origCityCode][destCityCode] = []; // O-d edge
					processedODs[destCityCode][origCityCode] = []; // D-o edge to avoid
				}

				if (lookupPosition.hasOwnProperty(destCityCode)) {
					const { end, middle, theta, pointP, pointQ, clock } = cachedGetTheMiddle(
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
					// To avoid visual duplication of curves!
					const edgeToBeProcessed = !processedODs[origCityCode][destCityCode].includes(edgeTranspModeName);
					processedODs[origCityCode][destCityCode].push(edgeTranspModeName);
					processedODs[destCityCode][origCityCode].push(edgeTranspModeName);
					// For each year the alpha will be retrieved
					for (let year = minYear; year <= maxYear; year++) {
						if (edgeTranspModeSpeed.tabSpeedPerYear[year]) {
							if (edgeTranspModeSpeed.terrestrial) {
								// We generate a cone and draw edges
								if (!cone.hasOwnProperty(year)) {
									// Initializing  complex cone for a given city and year
									const coneRoadAlpha =
										speedPerTransportPerYear[roadCode].tabSpeedPerYear[year].alpha;
									cone[year] = { coneRoadAlpha: coneRoadAlpha, tab: [] };
								}
								// this is where simple cones based on Road speed
								// or cones based on complex alphas will be built
								console.log(this); // , this.BigBoard.complexCones()); //,this.ConeBoard._complexCones);
								//if (this.ConeBoard.complexCones()) {
								//	alpha = edgeTranspModeSpeed.tabSpeedPerYear[year].alpha;
								//} else {
								alpha = speedPerTransportPerYear[roadCode].tabSpeedPerYear[year].alpha;
								//}
								cone[year].tab.push({ alpha, clock });
								destinationsWithModes[destCityCode][edgeTranspModeName].push({
									year,
									speed: edgeModeSpeed[year].speed,
								});
								if (edgeToBeProcessed) {
									// Condition to avoid visual duplication of curves!
									const modelledSpeed = getModelledSpeed(
										theta,
										maximumSpeed[year],
										edgeModeSpeed[year].speed,
										edgeTranspModeSpeed.terrestrial
									);
									// The ratio linking the current speed and maxSpeed is
									// computed according to this ![equation](http://bit.ly/2EejFpW)
									const speedRatio = (maximumSpeed[year] * theta) / (2 * modelledSpeed);
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
									maximumSpeed[year],
									edgeModeSpeed[year].speed,
									edgeTranspModeSpeed.terrestrial
								);
								// The ratio linking the current speed and maxSpeed is
								// computed according to this ![equation](http://bit.ly/2EejFpW)
								const speedRatio = (maximumSpeed[year] * theta) / (2 * modelledSpeed);
								// console.log('modelledSpeed', modelledSpeed);
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
			for (const yearC in cone) {
				if (cone.hasOwnProperty(yearC)) {
					cone[yearC].tab = cone[yearC].tab.sort((a, b) => a.clock - b.clock);
				}
			}
			//console.log(roadCode, speedPerTransportPerYear[roadCode]);
			if (Object.keys(cone).length === 0) {
				// The case of cities not being origin or destinations in the network
				// or only by aerial mode
				for (let year = minYear; year <= maxYear; year++) {
					const coneRoadAlpha = speedPerTransportPerYear[roadCode].tabSpeedPerYear[year].alpha;
					cone[year] = { coneRoadAlpha: coneRoadAlpha, tab: [] };
				}
			}

			network[origCityCode] = {
				referential,
				cone,
				destinationsWithModes,
				origCityProperties: city,
			};
			if (Object.keys(listOfCurves).length > 0) {
				// Retrieves edges info from origCityCode for curves generation
				curvesData[origCityCode] = { begin: startPoint, list: listOfCurves };
			}
		}
	});
	return { lookupCityNetwork: network, curvesData };
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
	private _transportModeSpeed: ITransportModeSpeed[] = [];
	private _transportMode: ITranspMode[] = [];
	private _transportNetwork: IEdge[] = [];
	private _state: IMergerState = 'missing';
	private _curvesAndCityGraph: ILookupCurvesAndCityGraph = <ILookupCurvesAndCityGraph>{};
	// private _complexCones: boolean;

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

	public get minYear(): number {
		return _minYear;
	}

	public get maxYear(): number {
		return _maxYear;
	}

	public get transportNames(): { curves: string[]; cones: string[] } {
		return _transportName;
	}

	public clear(): void {
		this._cities = [];
		this._populations = [];
		this._transportModeSpeed = [];
		this._transportMode = [];
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
	 *   * [[transportModeSpeed]],
	 *   * [[transportModeCode]],
	 *   * [[transportNetwork]],
	 *   * [[_state]]
	 * * link all these tables to each other
	 * * execute the main process i.e. [[networkFromCities]]
	 * * retrieve the resulting data into [[_edgesAndTranspModes]]
	 */
	public merge(): void {
		if (this._state === 'ready') {
			this._state = 'pending';
			// Csv parsing into tables
			const cities: ICity[] = JSON.parse(JSON.stringify(this._cities), reviver);
			const population: IPopulation[] = JSON.parse(JSON.stringify(this._populations), reviver);
			const transportMode: ITranspMode[] = JSON.parse(JSON.stringify(this._transportMode), reviver);
			const transportModeSpeed: ITransportModeSpeed[] = JSON.parse(
				JSON.stringify(this._transportModeSpeed),
				reviver
			);
			const transportNetwork: IEdge[] = JSON.parse(JSON.stringify(this._transportNetwork), reviver);

			// Linking tables to each other
			// merger(mother,     girl,               motherProp., girlProp.,      newName, forceArray, removeMotherProp., removeGirlProp.)
			// will link transport modes and speed
			merger(transportMode, transportModeSpeed, 'code', 'transportModeCode', 'speedTab', true, true, false);
			//    Merger(transportNetwork, transportModeCode, 'transportModeSpeed', 'code', 'transportDetails', false, false, false);
			// will link cities with population.csv file table information
			merger(cities, population, 'cityCode', 'cityCode', 'populations', false, true, false);
			// Attach city information to ending city edge
			merger(transportNetwork, cities, 'cityCodeDes', 'cityCode', 'destCityInfo', false, false, false);
			// Generates subgraph from city considered as origin
			merger(cities, transportNetwork, 'cityCode', 'cityCodeOri', 'edges', true, true, false);
			// The main function that generates geometries (cones, curves) by exploring the subgraphs from cities
			this._curvesAndCityGraph = networkFromCities(transportMode, cities, transportNetwork, transportModeSpeed);
			// for input data reading debugging
			console.log('curves & cityGraph', this._curvesAndCityGraph);
			this._state = 'missing';
			this._checkState();
		}
	}

	private _checkState(): void {
		if (this._state !== 'pending') {
			let state: IMergerState = 'missing';
			if (
				this._cities.length > 0 &&
				this._populations.length > 0 &&
				this._transportModeSpeed.length > 0 &&
				this._transportMode.length > 0 &&
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
