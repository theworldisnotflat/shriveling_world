/**
 * in merger we put the functions used only once
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
import * as Papa from 'papaparse';
import { NEDLocal } from '../common/referential';
import { interpolator, Cartographic, reviver } from '../common/utils';
import {
  ITranspMode, ICity, ITransportNetwork as ITranspNetwork,
  ILookupCityNetwork, IMergerState,
  ILookupDestWithModes, IPopulation, ITransportModeSpeed, ILookupEdgesWithTranspModes,
  ILookupEdges, ICityExtremityOfEdge, ILookupEdgeList, ILookupComplexAlpha,
} from '../definitions/project';
import { CONFIGURATION } from '../common/configuration';
/**
 * assure le croisement de deux tableaux d'objet sur un attribut. La clé de croisement
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
  mother: U[], girl: V[], motherProperty: string, girlProperty: string, newName: string, forceArray: boolean,
  girlPropertyToRemove: boolean, motherPropertyToRemove: boolean): void {
  let subGirl: V, subMother: U, attribute: string;
  let lookupGirl: { [x: string]: V | V[] } = {};
  let lessThanOne = !forceArray;
  for (let j = 0; j < girl.length; j++) {
    subGirl = girl[j];
    if (subGirl.hasOwnProperty(girlProperty) && subGirl[girlProperty] !== undefined && subGirl[girlProperty] !== null) {
      attribute = subGirl[girlProperty].toString();
      if (girlPropertyToRemove === true) {
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
  if (lessThanOne === true) {
    for (attribute in lookupGirl) {
      if (lookupGirl.hasOwnProperty(attribute)) {
        lookupGirl[attribute] = lookupGirl[attribute][0];
      }
    }
  }
  for (let i = 0; i < mother.length; i++) {
    subMother = mother[i];
    subMother[newName] = [];
    attribute = subMother[motherProperty];
    if (attribute !== undefined && attribute != null) {
      attribute = attribute.toString();
      if (lookupGirl.hasOwnProperty(attribute)) {
        subMother[newName] = lookupGirl[attribute];
      }
    }
    if (motherPropertyToRemove === true) {
      delete subMother[motherProperty];
    }
  }
}

/**
 * used for parsing data files
 */
const keyWords: { name: string, words: string[] }[] = [
  { name: '_cities', words: ['cityCode', 'latitude', 'longitude', 'radius'] },
  { name: '_transportModeSpeed', words: ['transportModeCode', 'year', 'speedKPH'] },
  { name: '_transportModeCode', words: ['code', 'name', 'yearBegin', 'terrestrial'] },
  { name: '_transportNetwork', words: ['transportMode', 'idDes', 'idOri'] },
  { name: '_populations', words: ['cityCode'] },
];

/**
 * "thetaLimit" = threshold angle of the modelled air services speed:
 * * beyond "thetaLimit" speed has the constant value "speed"
 * * below "thetaLimit" speed decreases from value "speed" to zero depending on the value of "theta"
 */
const thetaLimit = 2000 / (CONFIGURATION.earthRadiusMeters / 1000);
let _minYear: number = 2000;
let _maxYear: number = 1900;
let _transportName: { lines: string[], cones: string[] } = { lines: [], cones: [] };
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
function getCSV(text: string, isTransportModeCode: boolean = false): any {
  config['transform'] = undefined;
  if (isTransportModeCode === true) {
    config['transform'] = (value, field) => {
      if ('terrestrial' === field) {
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
function getTheMiddle(posA: Cartographic, posB: Cartographic)
  : { middle: Cartographic, theta: number } {
  const theta = posA.exactDistance(posB);
  const deltaLambda = posB.longitude - posA.longitude;
  const cosPhi2 = Math.cos(posB.latitude);
  const sinPhi2 = Math.sin(posB.latitude);
  const cosPhi1 = Math.cos(posA.latitude);
  const sinPhi1 = Math.sin(posA.latitude);
  const bx = cosPhi2 * Math.cos(deltaLambda);
  const by = cosPhi2 * Math.sin(deltaLambda);
  let resultat = new Cartographic();
  resultat.latitude = Math.atan2(sinPhi1 + sinPhi2, Math.sqrt((cosPhi1 + bx) * (cosPhi1 + bx) + by * by));
  resultat.longitude = posA.longitude + Math.atan2(by, cosPhi1 + bx);
  return { middle: resultat, theta: theta };
}

/**
 * getRatio function computes the speed ratio.
 *
 * In the case of air edges, two equations are used to determine
 * the [heigth of aerial edges above the geodesic](http://bit.ly/2H4FOKw):
 * * below the threshold limit:![below](http://bit.ly/2Xu3kGF)
 * * beyond the threshold limit: ![beyond](http://bit.ly/2EejFpW)
 * * the figure: ![2](http://bit.ly/2H4FOKw)
 *
 * * "ratio" is the part that differentiates the two equations
 *
 * [More detailed explanations here](https://timespace.hypotheses.org/121)
 *
 * @param theta
 * @param speedMax
 * @param speed
 */
function getRatio(theta: number, speedMax: number, speed: number, terrestrial: boolean): number {
  return terrestrial ? speedMax * theta / (2 * speed) : (theta < thetaLimit ? speedMax / 4778.25 : speedMax * theta / (2 * speed));
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
  transportModeCode: ITranspMode[], cities: ICity[], transpNetwork: ITranspNetwork[]): ILookupEdgesWithTranspModes {
  let network: ILookupCityNetwork = {};
  let edgesData: ILookupEdges = {};
  // déterminer la fourchette de temps considéré OK
  // determine the considered time-frame
  let actualYear = (new Date()).getFullYear();
  let minYear = actualYear, maxYear = 0;
  transpNetwork.forEach((item) => {
    if (minYear > item.yearBegin) {
      minYear = item.yearBegin;
    }
  });
  // déterminer pour chaque type de transport la vitesse par an
  // dans la fourchette + vitesse max par an de la fourchette OK
  /**
   * [[ISpeedPerYear]] is a table of speed per [[year]]
   */
  interface ISpeedPerYear {
    [year: string]: number;
  }
  /**
   * tableau associatif retournant pour une année donnée, la vitesse du transport le plus rapide
   *
   * association table indicating the maximum available speed on a given year
   */
  let maximumSpeed: ISpeedPerYear = {};
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
   * interface décrivant pour une année fixée la vitesse du transport ainsi que
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
    tabYearSpeed: { [year: string]: ICoupleTransportAlpha };
    name: string;
    terrestrial: boolean;
  }
  /**
   * ILookupCache concerns an edge with an end
   * middle, pointP at 1/4 anf pointQ at 3/4
   * and finally theta the angle between the two cities
   */
  interface ILookupCache {
    end?: ICityExtremityOfEdge;
    pointP: Cartographic;
    pointQ: Cartographic;
    middle: Cartographic;
    theta: number;
    clock: number;
  }
  let roadCode: number;
  _transportName = { lines: [], cones: [] };
  /**
   * Tableau associatif liant un mode de transport à un un objet de type [[ITabSpeedPerYearPerTranspModeItem]]
   *
   * association table linking a transpot mode to an object of type [[ITabSpeedPerYearPerTranspModeItem]]
   */
  let speedPerTransportPerYear: { [transportCode: string]: ITabSpeedPerYearPerTranspModeItem } = {};
  /**
   * pour chaque mode de transport:
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
  transportModeCode.forEach((transportMode) => {
    let transportCode = transportMode.code;
    let name = transportMode.name;
    if (name === 'Road') {
      roadCode = transportCode;
    }
    _transportName[transportMode.terrestrial === true ? 'cones' : 'lines'].push(name);
    let minYearTransport = Math.max(transportMode.yearBegin, minYear);
    let maxYearTransport = transportMode.yearEnd !== undefined ? transportMode.yearEnd : actualYear;
    let tempTransportCodeTab: ITransportCodeItem[] = [], tabYearSpeed: { [year: string]: ICoupleTransportAlpha } = {};
    let tempMaxYear: number = transportMode.yearEnd;

    transportMode.speeds.forEach((transportSpeed) => {
      tempTransportCodeTab.push({ speed: transportSpeed.speedKPH, year: transportSpeed.year });
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
    let interpolation = interpolator(tempTransportCodeTab, 'year', 'speed', false); // boolean à false pour interpoler au delà des limites!
    let speed: number;
    for (let year = minYearTransport; year <= maxYearTransport; year++) {
      speed = interpolation(year);
      tabYearSpeed[year] = { speed };
      if (maximumSpeed.hasOwnProperty(year)) {
        if (maximumSpeed[year] < speed) {
          maximumSpeed[year] = speed;
        }
      } else {
        maximumSpeed[year] = speed;
      }
    }
    speedPerTransportPerYear[transportCode] = { tabYearSpeed, name, terrestrial: transportMode.terrestrial };
  });

  _minYear = minYear;
  _maxYear = maxYear;
  // balayer speedPerTransportPerYear pour chaque mode de transport terrestre
  // et compléter avec l'angle de la pente alpha en accord avec l'équation 1!
  for (let transportCode in speedPerTransportPerYear) {
    // la condition sous entend que Road est du type terrestrial (attention dans fichier csv)
    if (speedPerTransportPerYear[transportCode].terrestrial === true) {
      let tabYearSpeed = speedPerTransportPerYear[transportCode].tabYearSpeed;
      for (let year in tabYearSpeed) {
        if (maximumSpeed.hasOwnProperty(year)) {
          // then we affect the slope of cones
          let speedMax = maximumSpeed[year];
          let speedAmb = tabYearSpeed[year].speed;
          // this is [equation 1](http://bit.ly/2tLfehC)
          // of the slope of the cone
          // executed because transport mode [[isTerrestrial]]
          let alpha = Math.atan(Math.sqrt(
            (speedMax / speedAmb) * (speedMax / speedAmb) - 1));
          if (alpha < 0) {
            alpha += CONFIGURATION.TWO_PI;
          }
          tabYearSpeed[year].alpha = alpha;
        }
      }
    }
  }
  // faire lookup des cartographic/referential par citycode. OK
  let lookupPosition: { [cityCode: string]: NEDLocal } = {};
  let lookupMiddle: { [cityCodeBegin: number]: { [cityCodeEnd: number]: ILookupCache } } = {};
  cities.forEach((city) => {
    let position = new Cartographic(city.longitude, city.latitude, 0, false);
    lookupPosition[city.cityCode] = new NEDLocal(position);
  });
  /**
   * fonction mettant en cache les calculs d'ouverture angulaire entre deux villes (l'ordre des villes n'a pas d'importance)
   *
   * function putting in cache the computation of angles and points between cities (the order of cities has no importance)
   * @param  begin code de la ville de début/starting city code
   * @param  end   code de la ville de fin/ending city code
   * @return       retourne le résultat des calculs prenant en compte les deux villes
   * en entrée (ouverture angulaire, points P et Q et point milieu)
   *
   * returns the result of the computation witht the two cities as input (opening theta, points P Q and midpoint)
   */
  function cachedGetTheMiddle(begin: number, end: number): ILookupCache {
    let res = <ILookupCache>{};
    res.end = { cityCode: end, position: lookupPosition[end].cartoRef };
    if (lookupMiddle.hasOwnProperty(begin)) {
      if (!lookupMiddle[begin].hasOwnProperty(end)) {
        let { middle, theta } = getTheMiddle(lookupPosition[begin].cartoRef, lookupPosition[end].cartoRef);
        let pointP = getTheMiddle(lookupPosition[begin].cartoRef, middle).middle;
        let pointQ = getTheMiddle(middle, lookupPosition[end].cartoRef).middle;
        let clock = lookupPosition[begin].getClock(lookupPosition[end].cartoRef);
        lookupMiddle[begin][end] = { pointP, pointQ, middle, theta, clock };
        if (!lookupMiddle.hasOwnProperty(end)) {
          lookupMiddle[end] = {};
        }
        clock = lookupPosition[end].getClock(lookupPosition[begin].cartoRef);
        lookupMiddle[end][begin] = { pointP: pointQ, pointQ: pointP, middle, theta, clock };
      }
    } else {
      let { middle, theta } = getTheMiddle(lookupPosition[begin].cartoRef, lookupPosition[end].cartoRef);
      let pointP = getTheMiddle(lookupPosition[begin].cartoRef, middle).middle;
      let pointQ = getTheMiddle(middle, lookupPosition[end].cartoRef).middle;
      let clock = lookupPosition[begin].getClock(lookupPosition[end].cartoRef);
      lookupMiddle[begin] = {};
      lookupMiddle[begin][end] = { pointP, pointQ, middle, theta, clock };
      if (!lookupMiddle.hasOwnProperty(end)) {
        lookupMiddle[end] = {};
      }
      clock = lookupPosition[end].getClock(lookupPosition[begin].cartoRef);
      lookupMiddle[end][begin] = { pointP: pointQ, pointQ: pointP, middle, theta, clock };
    }
    let cached = lookupMiddle[begin][end];
    res.middle = cached.middle;
    res.theta = cached.theta;
    res.pointQ = cached.pointQ;
    res.pointP = cached.pointP;
    res.clock = cached.clock;
    return res;
  }
  // processedODs will contain the value of edgeTranspModeName for each existing edge (OD)
  // processedODs évite de dupliquer visuellement les lignes:
  //  - génération de la ligne partant de cityA vers cityB
  //  - pas de génération de la ligne partant de cityB vers cityA grâce à processedODs
  let processedODs: { [begin: string]: { [end: string]: string[] } } = {};
  // second part of the function
  // the main loop for each city
  cities.forEach((city) => {
    let origCityCode = city.cityCode;
    let referential = lookupPosition[origCityCode];
    if (!processedODs.hasOwnProperty(origCityCode)) {
      processedODs[origCityCode] = {}; // creates an empty property for 'origCityCode'
    }
    if (referential instanceof NEDLocal) {
      let startPoint: ICityExtremityOfEdge = { cityCode: origCityCode, position: referential.cartoRef };
      /**
       *  list of edges from the considered city (described by their destination cities)
       * */
      let listOfEdges: { [cityCodeEnd: string]: ILookupEdgeList } = {};
      // let coneAlpha: ILookupConeAlpha = {};
      let terrestrialCone: ILookupComplexAlpha = {};
      let destinationsWithModes: ILookupDestWithModes = {};
      let destCityCode: number;
      let edge: ITranspNetwork, alpha: number;
      let edgeTranspModeName: string;
      let edgeTranspModeSpeed: ITabSpeedPerYearPerTranspModeItem;
      if (city.edges.length === 0) {
        city.edges.push({ yearBegin: minYear, idDes: -Infinity, transportMode: roadCode });
      }
      // for each edge incident to the city considered
      for (let i = 0; i < city.edges.length; i++) {
        edge = city.edges[i];
        destCityCode = edge.idDes;
        // edgeTranspModeSpeed is the key parameter of the process
        // it will be confronted to maximumSpeed[year]
        edgeTranspModeSpeed = speedPerTransportPerYear[edge.transportMode];
        // prepare tables
        if (!processedODs.hasOwnProperty(destCityCode)) {
          processedODs[destCityCode] = {};
        }
        if (!processedODs[origCityCode].hasOwnProperty(destCityCode)) {
          processedODs[origCityCode][destCityCode] = []; // o-d edge
          processedODs[destCityCode][origCityCode] = []; // d-o edge to avoid
        }
        if (lookupPosition.hasOwnProperty(destCityCode)) {
          let { end, middle, theta, pointP, pointQ, clock } = cachedGetTheMiddle(origCityCode, destCityCode);
          minYear = Math.min(edge.yearBegin, minYear);
          maxYear = edge.yearEnd ? edge.yearEnd : maxYear;
          edgeTranspModeName = edgeTranspModeSpeed.name;
          // prepare tables
          if (!destinationsWithModes.hasOwnProperty(destCityCode)) {
            destinationsWithModes[destCityCode] = {};
          }
          if (!destinationsWithModes[destCityCode].hasOwnProperty(edgeTranspModeName)) {
            destinationsWithModes[destCityCode][edgeTranspModeName] = [];
          }
          let edgeModeSpeed = edgeTranspModeSpeed.tabYearSpeed;
          // pour éviter la duplication des  lignes visuellement!
          let edgeToBeProcessed = processedODs[origCityCode][destCityCode].indexOf(edgeTranspModeName) === -1;
          processedODs[origCityCode][destCityCode].push(edgeTranspModeName);
          processedODs[destCityCode][origCityCode].push(edgeTranspModeName);
          // for each year the alpha will be computed
          for (let year = minYear; year <= maxYear; year++) {
            if (edgeTranspModeSpeed.terrestrial === true) {
              if (!terrestrialCone.hasOwnProperty(year)) {
                // initialisation du complexe cone pour une ville d'origine et une année fixée.
                let roadAlpha = speedPerTransportPerYear[roadCode].tabYearSpeed[year].alpha;
                terrestrialCone[year] = { roadAlpha, tab: [] };
              }
              alpha = edgeTranspModeSpeed.tabYearSpeed[year].alpha;
              terrestrialCone[year].tab.push({ alpha, clock });
              destinationsWithModes[destCityCode][edgeTranspModeName].push({ year: year, speed: edgeModeSpeed[year].speed });
              if (edgeToBeProcessed === true) { // condition pour éviter de générer deux lignes visuellement identiques!
                let ratio = getRatio(theta, edgeModeSpeed[year].speed, edgeModeSpeed[year].speed, edgeTranspModeSpeed.terrestrial);
                if (!listOfEdges.hasOwnProperty(destCityCode)) {
                  listOfEdges[destCityCode] = <ILookupEdgeList>{ end, middle, pointP, pointQ, theta, ratio: {} };
                }
                if (!listOfEdges[destCityCode].ratio.hasOwnProperty(edgeTranspModeName)) {
                  listOfEdges[destCityCode].ratio[edgeTranspModeName] = {};
                }
                listOfEdges[destCityCode].ratio[edgeTranspModeName][year] = ratio;
              }
            } else {
              // case when edge transport mode is not terrestrial
              // we will generate a line for the edge
              if (edgeToBeProcessed === true) { // condition pour éviter de générer deux lignes visuellement identiques!
                let ratio = getRatio(theta, maximumSpeed[year], edgeModeSpeed[year].speed, false);
                if (!listOfEdges.hasOwnProperty(destCityCode)) {
                  listOfEdges[destCityCode] = <ILookupEdgeList>{ end, middle, pointP, pointQ, theta, ratio: {} };
                }
                if (!listOfEdges[destCityCode].ratio.hasOwnProperty(edgeTranspModeName)) {
                  listOfEdges[destCityCode].ratio[edgeTranspModeName] = {};
                }
                listOfEdges[destCityCode].ratio[edgeTranspModeName][year] = ratio;
              }
            }
          }
        }
      }
      // à ce niveau, toutes les villes destinataires ont été balayées, il faut
      // remettre dans l'ordre de clock le tableau générant les cônes complexes
      // et insérer le résultat dans network et insérer les edgesData!
      for (let yearC in terrestrialCone) {
        if (terrestrialCone.hasOwnProperty(yearC)) {
          terrestrialCone[yearC].tab = terrestrialCone[yearC].tab.sort((a, b) => a.clock - b.clock);
        }
      }
      if (Object.keys(terrestrialCone).length === 0) { // cas des villes sans destinations ou uniquement des transports type aérien
        for (let year = minYear; year <= maxYear; year++) {
            let roadAlpha = speedPerTransportPerYear[roadCode].tabYearSpeed[year].alpha;
            terrestrialCone[year] = { roadAlpha, tab: [] };
        }
      }
      network[origCityCode] = { referential, terrestrialCone, destinationsWithModes: destinationsWithModes, origCityProperties: city };
      if (Object.keys(listOfEdges).length > 0) {
        // retrieves edges info from origCityCode for edges generation
        edgesData[origCityCode] = { begin: startPoint, list: listOfEdges };
      }
    }
  });
  return { lookupCityNetwork: network, edgesData: edgesData };
}

/**
 * the class [[Merger]] will
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
  private _transportNetwork: ITranspNetwork[] = [];
  private _state: IMergerState = 'missing';
  private _edgesAndTranspModes: ILookupEdgesWithTranspModes = <ILookupEdgesWithTranspModes>{};

  public get state(): IMergerState {
    return this._state;
  }
  /**
   * this is the resulting dataset processed by function [[networkFromCities]]
   * in order to give access to the relevant data inside bigBoard
   */
  public get edgesWithTranspModes(): ILookupEdgesWithTranspModes {
    return this._edgesAndTranspModes;
  }

  public get Cities(): ICity[] { return this._cities; }
  public CitiesByIndex(index: string | number): ICity { return this._cities[index]; }

  public get conesAndEdgesData(): ILookupEdgesWithTranspModes {
    return this._edgesAndTranspModes;
  }

  public get minYear(): number { return _minYear; }
  public get maxYear(): number { return _maxYear; }
  public get transportNames(): { lines: string[], cones: string[] } { return _transportName; }

  public clear(): void {
    this._cities = [];
    this._populations = [];
    this._transportModeSpeed = [];
    this._transportModeCode = [];
    this._transportNetwork = [];
    this._edgesAndTranspModes = <ILookupEdgesWithTranspModes>{};
    this._state = 'missing';
  }

  public add(someString: string): void {
    let rows = someString.split(/\r\n|\r|\n/);
    let headings = rows[0];
    let name: string, temp: string[], ok: boolean;
    for (let i = 0; i < keyWords.length && name === undefined; i++) {
      temp = keyWords[i].words;
      ok = true;
      for (let j = 0; j < temp.length && ok === true; j++) {
        if (headings.indexOf(temp[j]) === -1) {
          ok = false;
        }
      }
      if (ok === true) {
        name = keyWords[i].name;
      }
    }
    if (name !== undefined) {
      this[name] = [];
      this[name].push(...getCSV(someString, name === '_transportModeCode'));
      if (name === '_transportModeCode' || name === '_transportNetwork') {
        this[name].forEach((item: ITranspMode | ITranspNetwork) => {
          if (item.yearEnd === undefined || item.yearEnd === null || item.yearEnd.toString() === '') {
            delete item.yearEnd;
          }
        });
      }
      this._checkState();
    } else {
      throw new Error('scheme unknown');
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
      // csv parsing into tables
      let cities: ICity[] = JSON.parse(JSON.stringify(this._cities), reviver);
      let population: IPopulation[] = JSON.parse(JSON.stringify(this._populations), reviver);
      let transportModeCode: ITranspMode[] = JSON.parse(JSON.stringify(this._transportModeCode), reviver);
      let transportModeSpeed: ITransportModeSpeed[] = JSON.parse(JSON.stringify(this._transportModeSpeed), reviver);
      let transportNetwork: ITranspNetwork[] = JSON.parse(JSON.stringify(this._transportNetwork), reviver);

      // linking tables to eachother
      // merger(mother, girl, motherProp., girlProp., newName, forceArray, removeMotherProp., removeGirlProp.)
      // will link transport modes and speed
      merger(transportModeCode, transportModeSpeed, 'code', 'transportModeCode', 'speeds', true, true, false);
      //    merger(transportNetwork, transportModeCode, 'transportModeSpeed', 'code', 'transportDetails', false, false, false);
      // will link cities with population.csv file table information
      merger(cities, population, 'cityCode', 'cityCode', 'populations', false, true, false);
      // attach city information to ending city edge
      merger(transportNetwork, cities, 'idDes', 'cityCode', 'destCityInfo', false, false, false);
      // generates subgraph from city considered as origin
      merger(cities, transportNetwork, 'cityCode', 'idOri', 'edges', true, true, false);
      // the main function that generates geometries (cones, lines) by exploring the subgraphs from cities
      this._edgesAndTranspModes = networkFromCities(transportModeCode, cities, transportNetwork);
      this._state = 'missing';
      this._checkState();
    }
  }

  private _checkState(): void {
    if (this._state !== 'pending') {
      let state: IMergerState = 'missing';
      if (this._cities.length > 0 && this._populations.length > 0 &&
        this._transportModeSpeed.length > 0 && this._transportModeCode.length > 0 &&
        this._transportNetwork.length > 0) {
        state = 'ready';
        if (Object.keys(this._edgesAndTranspModes).length > 0) {
          state = 'complete';
        }
      }
      this._state = state;
    }
  }

}
