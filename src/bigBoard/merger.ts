/**
 * In merger we put the functions used only once
 * which are CPU/GPU intensive functions
 * and which compute the geometry of cones and edges.
 * the functions that must run each time a parameter is modified
 * are located in the respective files for cones and edges
 *
 * The general achitecture of the project is:
 * * merger with computing intensive functions used once
 * * shaders with functions fast to execute in interaction with the user
 * * display conversions where final computation occurs, including geographical projections
 *
 */
'use strict';
import Papa from 'papaparse';
import {NEDLocal} from '../common/referential';
import {interpolator, Cartographic, reviver} from '../common/utils';
import {
	ITranspMode,
	ICity,
	IEdge,
	ILookupCityNetwork,
	IMergerState,
	ILookupDestWithModes,
	IPopulation,
	ITransportModeSpeed,
	ILookupEdgesAndCityNetwork,
	ILookupEdges,
	ICityExtremityOfEdge,
	ILookupEdgeList,
	ILookupComplexAlpha,
} from '../definitions/project';
import {CONFIGURATION} from '../common/configuration';
/**
 * Assure le croisement de deux tableaux d'objet sur un attribut. La clé de croisement
 * est renommée. À la fin de la procédure, le tableau receptacle est enrichi.
 *
 * realises the merge of two tables base on an attribute. The key for the merge is renamed.
 * At the end of the process the recipient table is enriched.
 *
 * @param mother le tableau d'objet receptacle du croisement/the recipient table
 * @param girl le tableau qui complète le tableau précédent/where additional data lies
 * @param motherProperty l'attribut du tableau mother sur lequel le croisement se fera/the property of the merge
 * @param girlProperty l'attribut du tableau girl sur lequel le croisement se fera/the property of the merge
 * @param newName le nom de l'attribut issu du croisement dans le tableau mother/
 * @param forceArray force l'attribut synthétique à être un tableau
 * @param girlPropertyToRemove indique si on doit retirer la propriété dans le tableau girl
 * @param motherPropertyToRemove indique si on doit retirer la propriété dans le tableau girl
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
	const lookupGirl: {[x: string]: V | V[]} = {};
	let lessThanOne = !forceArray;
	for (const element of girl) {
		subGirl = element;
		if (subGirl.hasOwnProperty(girlProperty) && subGirl[girlProperty] !== undefined && subGirl[girlProperty] !== null) {
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
 * Used for parsing data files with columns
 */
const keyWords: Array<{name: string; words: string[]}> = [
	{name: '_cities', words: ['cityCode', 'latitude', 'longitude', 'radius']},
	{name: '_transportModeSpeed', words: ['transportModeCode', 'year', 'speedKPH']},
	{name: '_transportModeCode', words: ['code', 'name', 'yearBegin', 'terrestrial']},
	{name: '_transportNetwork', words: ['transportMode', 'idDes', 'idOri']},
	{name: '_populations', words: ['cityCode']},
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
let _transportName: {lines: string[]; cones: string[]} = {lines: [], cones: []};
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
 * @param {string} text
 * @param {boolean} [isTransportModeCode=false]
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
function getTheMiddle(posA: Cartographic, posB: Cartographic): {middle: Cartographic; theta: number} {
	const theta = posA.exactDistance(posB);
	const deltaLambda = posB.longitude - posA.longitude;
	const cosPhi2 = Math.cos(posB.latitude);
	const sinPhi2 = Math.sin(posB.latitude);
	const cosPhi1 = Math.cos(posA.latitude);
	const sinPhi1 = Math.sin(posA.latitude);
	const bx = cosPhi2 * Math.cos(deltaLambda);
	const by = cosPhi2 * Math.sin(deltaLambda);
	const resultat = new Cartographic();
	resultat.latitude = Math.atan2(sinPhi1 + sinPhi2, Math.sqrt((cosPhi1 + bx) * (cosPhi1 + bx) + by * by));
	resultat.longitude = posA.longitude + Math.atan2(by, cosPhi1 + bx);
	return {middle: resultat, theta};
}

/**
 * [[getModelledSpeed]] computes a new speed for aerial links
 * having a length less than [[thetaLimit]]
 * this modelled speed will be lower than the considered mode speed
 *
 * [[theta]] is the angle between the two cities
 * in the unprojected situation
 *
 * In the case of air edges, two equations are used to determine
 * the [heigth of aerial edges above the geodesic](http://bit.ly/2H4FOKw):
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
		  // for Germany based on Hamburg-München route 600 km, 1h20 = 450 kph (factor 0.75)
		  // (CONFIGURATION.earthRadiusMeters / 1000) * theta * 0.375 :
		  // (CONFIGURATION.earthRadiusMeters / 1000) * theta * 750 / 2000 :
		  ((CONFIGURATION.earthRadiusMeters / 1000) * theta * 450) / 600
		: speed;
}

/**
 * [[networkFromCities]] is the main function of the project
 *
 * function [[networkFromCities]] explores the [[transportNetwork]]
 * around each city in order to
 * * determine the geometry of cones ([[cities]])
 * * and to draw lines
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
 * @param transportModeCode
 * @param cities
 * @param transpNetwork
 */
function networkFromCities(
	transportModeCode: ITranspMode[],
	cities: ICity[],
	transpNetwork: IEdge[]
): ILookupEdgesAndCityNetwork {
	const network: ILookupCityNetwork = {};
	const edgesData: ILookupEdges = {};
	// Déterminer la fourchette de temps considéré OK
	// determine the considered time-frame
	const actualYear = new Date().getFullYear();
	let minYear = actualYear;
	let maxYear = 0;
	transpNetwork.forEach(item => {
		if (minYear > item.yearBegin) {
			minYear = item.yearBegin;
		}
	});
	// Déterminer pour chaque type de transport la vitesse par an
	// dans la fourchette + vitesse max par an de la fourchette OK
	/**
	 * [[ISpeedPerYear]] is a table of speed per [[year]]
	 */
	interface ISpeedPerYear {
		[year: string]: number;
	}
	/**
	 * Tableau associatif retournant pour une année donnée, la vitesse du transport le plus rapide
	 *
	 * association table indicating the maximum available speed on a given year
	 */
	const maximumSpeed: ISpeedPerYear = {};
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
	 * Interface décrivant pour une année fixée la vitesse du transport ainsi que
	 * le ratio décrit dans l'[equation 1](http://bit.ly/2tLfehC) de la pente d'un cône
	 */
	interface ICoupleTransportAlpha {
		speed: number;
		alpha?: number;
	}
	/**
	 * Interface ayant pour attributs le nom du transport considéré et son tableau
	 * de vitesses. Ce tableau associe à une année la vitesse (dans la limite de
	 * la fenêtre temporelle décrite dans le fichier csv initial) du mode de transport.
	 */
	interface ITabSpeedPerYearPerTranspModeItem {
		tabYearSpeed: {[year: string]: ICoupleTransportAlpha};
		name: string;
		terrestrial: boolean;
	}
	/**
	 * [[ILookupCacheAnchorsEdgeCone]] describes:
	 * * an edge with an end middle, pointP
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
	_transportName = {lines: [], cones: []};
	/**
	 * Tableau associatif liant un mode de transport à un un objet de type [[ITabSpeedPerYearPerTranspModeItem]]
	 *
	 * association table linking a transpot mode to an object of type [[ITabSpeedPerYearPerTranspModeItem]]
	 */
	const speedPerTransportPerYear: {[transportCode: string]: ITabSpeedPerYearPerTranspModeItem} = {};
	/**
	 * Pour chaque mode de transport:
	 *  * on détermine si c'est de type terrestrev(cône) ou aérien (lignes)
	 *  * la fenêtre temporelle du mode de transport
	 *  * le tableau de vitesse du mode de transport considéré.
	 *    La formule d'interpolation utilisées pour constituer ce tableau retourne
	 *    pour chaque année de la fenêtre temporelle précédemment calculée
	 *    une vitesse interpolée linéairement entre deux dates où la vitesse était connue.
	 *  À la sortie de cette boucle, [[speedPerTransportPerYear]]  et [[maximumSpeed]] sont renseignés
	 *
	 * For each transport mode:
	 * * we dertermine if it is terrestrial (cones) or not (line)
	 * * the temporal scope of the transort mode
	 * * the table of speed of the considered transport modes.
	 * the interpolation function used to populate the table returns
	 * for each year in the temporal scope an interpolated speed between
	 * the two dates when the speed is known
	 *
	 * At the end of this loop [[speedPerTransportPerYear]] and [[maximumSpeed]] are populated
	 */
	transportModeCode.forEach(transportMode => {
		const transportCode = transportMode.code;
		const name = transportMode.name;
		if (name === 'Road') {
			roadCode = transportCode;
		}

		_transportName[transportMode.terrestrial ? 'cones' : 'lines'].push(name);
		const minYearTransport = Math.max(transportMode.yearBegin, minYear);
		let maxYearTransport = transportMode.yearEnd === undefined ? actualYear : transportMode.yearEnd;
		let tempTransportCodeTab: ITransportCodeItem[] = [];
		const tabYearSpeed: {[year: string]: ICoupleTransportAlpha} = {};
		let tempMaxYear: number = transportMode.yearEnd;

		transportMode.speeds.forEach(transportSpeed => {
			tempTransportCodeTab.push({speed: transportSpeed.speedKPH, year: transportSpeed.year});
			if (maxYear < transportSpeed.year) {
				maxYear = transportSpeed.year;
			}

			if (tempMaxYear === undefined) {
				tempMaxYear = transportSpeed.year;
			}

			tempMaxYear = Math.max(tempMaxYear, transportSpeed.year);
		});
		maxYearTransport = Math.max(maxYearTransport, tempMaxYear);
		tempTransportCodeTab = tempTransportCodeTab.sort((a, b) => a.year - b.year);
		const interpolation = interpolator(tempTransportCodeTab, 'year', 'speed', false); // Boolean à false pour interpoler au delà des limites!
		let speed: number;
		for (let year = minYearTransport; year <= maxYearTransport; year++) {
			speed = interpolation(year);
			tabYearSpeed[year] = {speed};
			if (maximumSpeed.hasOwnProperty(year)) {
				if (maximumSpeed[year] < speed) {
					maximumSpeed[year] = speed;
				}
			} else {
				maximumSpeed[year] = speed;
			}
		}

		speedPerTransportPerYear[transportCode] = {tabYearSpeed, name, terrestrial: transportMode.terrestrial};
	});

	_minYear = minYear;
	_maxYear = maxYear;
	// Balayer speedPerTransportPerYear pour chaque mode de transport terrestre
	// et compléter avec l'angle de la pente alpha en accord avec l'équation 1!
	for (const transportCode in speedPerTransportPerYear) {
		// La condition sous entend que Road est du type terrestrial (attention dans fichier csv)
		if (speedPerTransportPerYear[transportCode].terrestrial) {
			const tabYearSpeed = speedPerTransportPerYear[transportCode].tabYearSpeed;
			for (const year in tabYearSpeed) {
				if (maximumSpeed.hasOwnProperty(year)) {
					// Then we affect the slope of cones
					const maxSpeed = maximumSpeed[year];
					const speedAmb = tabYearSpeed[year].speed;
					// This is [equation 1](http://bit.ly/2tLfehC)
					// of the slope of the cone
					// executed because transport mode [[isTerrestrial]]
					let alpha = Math.atan(Math.sqrt((maxSpeed / speedAmb) * (maxSpeed / speedAmb) - 1));
					if (alpha < 0) {
						alpha += CONFIGURATION.TWO_PI;
					}

					tabYearSpeed[year].alpha = alpha;
				}
			}
		}
	}

	// Faire lookup des cartographic/referential par citycode. OK
	const lookupPosition: {[cityCode: string]: NEDLocal} = {};
	const lookupMiddle: {[cityCodeBegin: number]: {[cityCodeEnd: number]: ILookupCacheAnchorsEdgeCone}} = {};
	cities.forEach(city => {
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
	 * @param  end   ending city code
	 * @return returns the result of the computation with the two cities as input
	 * (opening theta, points P Q and midpoint)
	 */
	function cachedGetTheMiddle(begin: number, end: number): ILookupCacheAnchorsEdgeCone {
		const res = <ILookupCacheAnchorsEdgeCone>{};
		res.end = {cityCode: end, position: lookupPosition[end].cartoRef};
		if (lookupMiddle.hasOwnProperty(begin)) {
			if (!lookupMiddle[begin].hasOwnProperty(end)) {
				const {middle, theta} = getTheMiddle(lookupPosition[begin].cartoRef, lookupPosition[end].cartoRef);
				const pointP = getTheMiddle(lookupPosition[begin].cartoRef, middle).middle;
				const pointQ = getTheMiddle(middle, lookupPosition[end].cartoRef).middle;
				let clock = lookupPosition[begin].getClock(lookupPosition[end].cartoRef);
				lookupMiddle[begin][end] = {pointP, pointQ, middle, theta, clock};
				if (!lookupMiddle.hasOwnProperty(end)) {
					lookupMiddle[end] = {};
				}

				clock = lookupPosition[end].getClock(lookupPosition[begin].cartoRef);
				lookupMiddle[end][begin] = {pointP: pointQ, pointQ: pointP, middle, theta, clock};
			}
		} else {
			const {middle, theta} = getTheMiddle(lookupPosition[begin].cartoRef, lookupPosition[end].cartoRef);
			const pointP = getTheMiddle(lookupPosition[begin].cartoRef, middle).middle;
			const pointQ = getTheMiddle(middle, lookupPosition[end].cartoRef).middle;
			let clock = lookupPosition[begin].getClock(lookupPosition[end].cartoRef);
			lookupMiddle[begin] = {};
			lookupMiddle[begin][end] = {pointP, pointQ, middle, theta, clock};
			if (!lookupMiddle.hasOwnProperty(end)) {
				lookupMiddle[end] = {};
			}

			clock = lookupPosition[end].getClock(lookupPosition[begin].cartoRef);
			lookupMiddle[end][begin] = {pointP: pointQ, pointQ: pointP, middle, theta, clock};
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
	// processedODs évite de dupliquer visuellement les lignes:
	//  - génération de la ligne partant de cityA vers cityB
	//  - pas de génération de la ligne partant de cityB vers cityA grâce à processedODs
	const processedODs: {[begin: string]: {[end: string]: string[]}} = {};
	// Second part of the function
	// the main loop for each city
	cities.forEach(city => {
		const origCityCode = city.cityCode;
		const referential = lookupPosition[origCityCode];
		if (!processedODs.hasOwnProperty(origCityCode)) {
			processedODs[origCityCode] = {}; // Creates an empty property for 'origCityCode'
		}

		if (referential instanceof NEDLocal) {
			const startPoint: ICityExtremityOfEdge = {cityCode: origCityCode, position: referential.cartoRef};
			/**
			 *  List of edges from the considered city (described by their destination cities)
			 * */
			const listOfEdges: {[cityCodeEnd: string]: ILookupEdgeList} = {};
			// Let coneAlpha: ILookupConeAlpha = {};
			const cone: ILookupComplexAlpha = {};
			const destinationsWithModes: ILookupDestWithModes = {};
			let destCityCode: number;
			let edge: IEdge;
			let alpha: number;
			let edgeTranspModeName: string;
			let edgeTranspModeSpeed: ITabSpeedPerYearPerTranspModeItem;
			if (city.edges.length === 0) {
				city.edges.push({yearBegin: minYear, idDes: -Infinity, transportMode: roadCode});
			}

			// For each edge incident to the city considered
			for (let i = 0; i < city.edges.length; i++) {
				edge = city.edges[i];
				destCityCode = edge.idDes;
				// EdgeTranspModeSpeed is the key parameter of the process
				// it will be confronted to maximumSpeed[year]
				edgeTranspModeSpeed = speedPerTransportPerYear[edge.transportMode];
				// Prepare tables
				if (!processedODs.hasOwnProperty(destCityCode)) {
					processedODs[destCityCode] = {};
				}

				if (!processedODs[origCityCode].hasOwnProperty(destCityCode)) {
					processedODs[origCityCode][destCityCode] = []; // O-d edge
					processedODs[destCityCode][origCityCode] = []; // D-o edge to avoid
				}

				if (lookupPosition.hasOwnProperty(destCityCode)) {
					const {end, middle, theta, pointP, pointQ, clock} = cachedGetTheMiddle(origCityCode, destCityCode);
					minYear = Math.min(edge.yearBegin, minYear);
					maxYear = edge.yearEnd ? edge.yearEnd : maxYear;
					edgeTranspModeName = edgeTranspModeSpeed.name;
					// Prepare tables
					if (!destinationsWithModes.hasOwnProperty(destCityCode)) {
						destinationsWithModes[destCityCode] = {};
					}

					if (!destinationsWithModes[destCityCode].hasOwnProperty(edgeTranspModeName)) {
						destinationsWithModes[destCityCode][edgeTranspModeName] = [];
					}

					const edgeModeSpeed = edgeTranspModeSpeed.tabYearSpeed;
					// To avoid visual duplication of lines!
					const edgeToBeProcessed = !processedODs[origCityCode][destCityCode].includes(edgeTranspModeName);
					processedODs[origCityCode][destCityCode].push(edgeTranspModeName);
					processedODs[destCityCode][origCityCode].push(edgeTranspModeName);
					// For each year the alpha will be computed
					for (let year = minYear; year <= maxYear; year++) {
						if (edgeTranspModeSpeed.terrestrial) {
							// We generate a cone and draw edges
							if (!cone.hasOwnProperty(year)) {
								// Initialising  complex cone for a given city and year
								const coneAlpha = speedPerTransportPerYear[roadCode].tabYearSpeed[year].alpha;
								cone[year] = {coneAlpha, tab: []};
							}

							alpha = edgeTranspModeSpeed.tabYearSpeed[year].alpha;
							cone[year].tab.push({alpha, clock});
							destinationsWithModes[destCityCode][edgeTranspModeName].push({
								year,
								speed: edgeModeSpeed[year].speed,
							});
							if (edgeToBeProcessed) {
								// Condition to avoid visual duplication of lines!
								const modelledSpeed = getModelledSpeed(
									theta,
									maximumSpeed[year],
									edgeModeSpeed[year].speed,
									edgeTranspModeSpeed.terrestrial
								);
								// The ratio linking the current speed and maxSpeed is
								// computed according to this ![equation](http://bit.ly/2EejFpW)
								const speedRatio = (maximumSpeed[year] * theta) / (2 * modelledSpeed);
								if (!listOfEdges.hasOwnProperty(destCityCode)) {
									listOfEdges[destCityCode] = <ILookupEdgeList>{
										end,
										middle,
										pointP,
										pointQ,
										theta,
										speedRatio: {},
									};
								}

								if (!listOfEdges[destCityCode].speedRatio.hasOwnProperty(edgeTranspModeName)) {
									listOfEdges[destCityCode].speedRatio[edgeTranspModeName] = {};
								}

								listOfEdges[destCityCode].speedRatio[edgeTranspModeName][year] = speedRatio;
							}
						} else if (edgeToBeProcessed) {
							// Case when edge transport mode is not terrestrial
							// we will generate a line for the edge
							// Condition pour éviter de générer deux lignes visuellement identiques!
							const modelledSpeed = getModelledSpeed(
								theta,
								maximumSpeed[year],
								edgeModeSpeed[year].speed,
								edgeTranspModeSpeed.terrestrial
							);
							// The ratio linking the current speed and maxSpeed is
							// computed according to this ![equation](http://bit.ly/2EejFpW)
							const speedRatio = (maximumSpeed[year] * theta) / (2 * modelledSpeed);
							debugger;
							// Console.log('destCity', this._cities[destCityCode].urbanAgglomeration);
							// console.log('origCity', this._cities[origCityCode].urbanAgglomeration);
							// console.log('orig', city.urbanAgglomeration);
							// console.log('mode', edgeTranspModeSpeed.name);
							// console.log('theta km', (CONFIGURATION.earthRadiusMeters / 1000) * theta);
							// console.log('edgeModeSpeed[year].speed', edgeModeSpeed[year].speed);
							// console.log('modelledSpeed', modelledSpeed);
							if (!listOfEdges.hasOwnProperty(destCityCode)) {
								listOfEdges[destCityCode] = <ILookupEdgeList>{
									end,
									middle,
									pointP,
									pointQ,
									theta,
									speedRatio: {},
								};
							}

							if (!listOfEdges[destCityCode].speedRatio.hasOwnProperty(edgeTranspModeName)) {
								listOfEdges[destCityCode].speedRatio[edgeTranspModeName] = {};
							}

							listOfEdges[destCityCode].speedRatio[edgeTranspModeName][year] = speedRatio;
						}
					}
				}
			}

			// À ce niveau, toutes les villes destinataires ont été balayées, il faut
			// remettre dans l'ordre de clock le tableau générant les cônes complexes
			// et insérer le résultat dans network et insérer les edgesData!
			for (const yearC in cone) {
				if (cone.hasOwnProperty(yearC)) {
					cone[yearC].tab = cone[yearC].tab.sort((a, b) => a.clock - b.clock);
				}
			}

			if (Object.keys(cone).length === 0) {
				// Cas des villes sans destinations ou uniquement des transports type aérien
				for (let year = minYear; year <= maxYear; year++) {
					const coneAlpha = speedPerTransportPerYear[roadCode].tabYearSpeed[year].alpha;
					cone[year] = {coneAlpha, tab: []};
				}
			}

			network[origCityCode] = {
				referential,
				cone,
				destinationsWithModes,
				origCityProperties: city,
			};
			if (Object.keys(listOfEdges).length > 0) {
				// Retrieves edges info from origCityCode for edges generation
				edgesData[origCityCode] = {begin: startPoint, list: listOfEdges};
			}
		}
	});
	return {lookupCityNetwork: network, edgesData};
}

/**
 * The class [[Merger]] will
 * * introduce the data into tables
 *   * [[_cities]],
 *   * [[_populations]],
 *   * [[_transportModeSpeed]],
 *   * [[_transportModeCode]],
 *   * [[_transportNetwork]],
 *   * [[_state]] and
 *   * [[_edgesAndTranspModes]]
 *
 * This class will contain the function [[merge]]
 */
export class Merger {
	private _cities: ICity[] = [];
	private _populations: IPopulation[] = [];
	private _transportModeSpeed: ITransportModeSpeed[] = [];
	private _transportModeCode: ITranspMode[] = [];
	private _transportNetwork: IEdge[] = [];
	private _state: IMergerState = 'missing';
	private _edgesAndTranspModes: ILookupEdgesAndCityNetwork = <ILookupEdgesAndCityNetwork>{};

	public get state(): IMergerState {
		return this._state;
	}

	/**
	 * This is the resulting dataset processed by function [[networkFromCities]]
	 * in order to give access to the relevant data inside bigBoard
	 */
	public get edgesWithTranspModes(): ILookupEdgesAndCityNetwork {
		return this._edgesAndTranspModes;
	}

	public get Cities(): ICity[] {
		return this._cities;
	}

	public CitiesByIndex(index: string | number): ICity {
		return this._cities[index];
	}

	public get conesAndEdgesData(): ILookupEdgesAndCityNetwork {
		return this._edgesAndTranspModes;
	}

	public get minYear(): number {
		return _minYear;
	}

	public get maxYear(): number {
		return _maxYear;
	}

	public get transportNames(): {lines: string[]; cones: string[]} {
		return _transportName;
	}

	public clear(): void {
		this._cities = [];
		this._populations = [];
		this._transportModeSpeed = [];
		this._transportModeCode = [];
		this._transportNetwork = [];
		this._edgesAndTranspModes = <ILookupEdgesAndCityNetwork>{};
		this._state = 'missing';
	}

	public add(someString: string): void {
		const rows = someString.split(/\r\n|\r|\n/);
		const headings = rows[0];
		let name: string;
		let temp: string[];
		let ok: boolean;
		for (let i = 0; i < keyWords.length && name === undefined; i++) {
			temp = keyWords[i].words;
			ok = true;
			for (let j = 0; j < temp.length && ok; j++) {
				if (!headings.includes(temp[j])) {
					ok = false;
				}
			}

			if (ok) {
				name = keyWords[i].name;
			}
		}

		if (name === undefined) {
			throw new Error('scheme unknown');
		} else {
			this[name] = [];
			this[name].push(...getCSV(someString, name === '_transportModeCode'));
			if (name === '_transportModeCode' || name === '_transportNetwork') {
				this[name].forEach((item: ITranspMode | IEdge) => {
					if (item.yearEnd === undefined || item.yearEnd === null || item.yearEnd.toString() === '') {
						delete item.yearEnd;
					}
				});
			}

			this._checkState();
		}
	}

	/**
	 * The function [[merge]] will
	 * * retrieve all from csv files
	 * * introduce the data into tables:
	 *   * [[cities]],
	 *   * [[population]],
	 *   * [[transportModeSpeed]],
	 *   * [[transportModeCode]],
	 *   * [[transportNetwork]],
	 *   * [[_state]]
	 * * link all these tables to each other
	 * * execute the main process i.e. [[networkFromCities]]
	 * * retrievec resulting data into [[_edgesAndTranspModes]]
	 */
	public merge(): void {
		if (this._state === 'ready') {
			this._state = 'pending';
			// Csv parsing into tables
			const cities: ICity[] = JSON.parse(JSON.stringify(this._cities), reviver);
			const population: IPopulation[] = JSON.parse(JSON.stringify(this._populations), reviver);
			const transportModeCode: ITranspMode[] = JSON.parse(JSON.stringify(this._transportModeCode), reviver);
			const transportModeSpeed: ITransportModeSpeed[] = JSON.parse(JSON.stringify(this._transportModeSpeed), reviver);
			const transportNetwork: IEdge[] = JSON.parse(JSON.stringify(this._transportNetwork), reviver);

			// Linking tables to eachother
			// merger(mother, girl, motherProp., girlProp., newName, forceArray, removeMotherProp., removeGirlProp.)
			// will link transport modes and speed
			merger(transportModeCode, transportModeSpeed, 'code', 'transportModeCode', 'speeds', true, true, false);
			//    Merger(transportNetwork, transportModeCode, 'transportModeSpeed', 'code', 'transportDetails', false, false, false);
			// will link cities with population.csv file table information
			merger(cities, population, 'cityCode', 'cityCode', 'populations', false, true, false);
			// Attach city information to ending city edge
			merger(transportNetwork, cities, 'idDes', 'cityCode', 'destCityInfo', false, false, false);
			// Generates subgraph from city considered as origin
			merger(cities, transportNetwork, 'cityCode', 'idOri', 'edges', true, true, false);
			// The main function that generates geometries (cones, lines) by exploring the subgraphs from cities
			this._edgesAndTranspModes = networkFromCities(transportModeCode, cities, transportNetwork);
			// Console.log(this._edgesAndTranspModes);
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
				this._transportModeCode.length > 0 &&
				this._transportNetwork.length > 0
			) {
				state = 'ready';
				if (Object.keys(this._edgesAndTranspModes).length > 0) {
					state = 'complete';
				}
			}

			this._state = state;
		}
	}
}
