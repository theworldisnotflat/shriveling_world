/**
 * in merger we put the functions used only once
 * which are CPU/GPU intensive functions
 * and which compute the geometry of cones and edges.
 * the functions that must run each time a parameter is modified
 * are located in the respective files for cones and edges
 *
 * The general achitecture of the project is:
 * * merger with computing intensive functions used once
 * * shaders with functionsfast to execute in interaction with the user
 * * display conversions where final computation occurs, including geographical projections
 *
 */
'use strict';
import * as Papa from 'papaparse';
import { NEDLocal } from '../common/referential';
import { extrapolator, Cartographic, reviver } from '../common/utils';
import {
  ITransportModeCode, ICity, ITransportNetwork, ILookupCityTransport, IMergerState,
  ILookupDestination, IPopulation, ITransportModeSpeed, ILookupAndMaxSpeedAndLine, ILookupLine, IEndCityLine,
  ILookupEdgeList, ILookupTransportAlpha,
} from '../definitions/project';
import { CONFIGURATION } from '../common/configuration';
/**
 *
 * @param mother
 * @param girl
 * @param motherProperty
 * @param girlProperty
 * @param newName
 * @param forceArray
 * @param girlPropertyToRemove
 * @param motherPropertyToRemove
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

// used for parsing data files
const keyWords: { name: string, words: string[] }[] = [
  { name: '_cities', words: ['cityCode', 'latitude', 'longitude', 'radius'] },
  { name: '_transportModeSpeed', words: ['transportModeCode', 'year', 'speedKPH'] },
  { name: '_transportModeCode', words: ['code', 'name', 'yearBegin', 'terrestrial'] },
  { name: '_transportNetwork', words: ['transportModeSpeed', 'idDes', 'idOri'] },
  { name: '_populations', words: ['cityCode'] },
];

// "thetaLimit" = threshold angle of the modelled air services speed:
// - beyond "thetaLimit" speed has the constant value "speed"
// - below "thetaLimit" speed decreases from value "speed" to zero depending on the value of "theta"
const thetaLimit = 2000 / (CONFIGURATION.earthRadiusMeters / 1000);
let _minYear: number = 1930;
let _maxYear: number = 1932;
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
function getRatio(theta: number, speedMax: number, speed: number): number {
  return theta < thetaLimit ? speedMax / 4778.25 : speedMax * theta / (2 * speed);
}

/**
 * function [[toCityTransport]] explores the [[transportNetwork]]
 * in order to determine the geometry of cones ([[cities]])
 * and to draw lines
 *
 * First part of the function is putting in cache all the computations needed from each city, and especially  the [[referential]]
 *
 * Second part of the function explores the network from each city
 *
 * ![equation 1](http://bit.ly/2tLfehC) equation 1 is on lines 354 and 404
 *
 * ![figure 1](http://bit.ly/2HhgxNg)
 *
 * More about the [geometry of cones](https://timespace.hypotheses.org/121)
 *
 * @param transportModeCode
 * @param cities
 * @param transportNetwork
 */
function toCityTransport(
  transportModeCode: ITransportModeCode[], cities: ICity[], transportNetwork: ITransportNetwork[]): ILookupAndMaxSpeedAndLine {
  let resultat: ILookupCityTransport = {};
  let lineData: ILookupLine = {};
  // déterminer la fourchette de temps considéré OK
  // determine the considered time-frame
  let actualYear = (new Date()).getFullYear();
  let minYear = actualYear, maxYear = 0;
  transportNetwork.forEach((item) => {
    if (minYear > item.yearBegin) {
      minYear = item.yearBegin;
    }
  });
  // déterminer pour chaque type de transport la vitesse par an
  // dans la fourchette + vitesse max par an de la fourchette OK
  /**
   * [[ISpeedPerYear]] has a [[year]]
   */
  interface ISpeedPerYear {
    [year: string]: number;
  }
  /**
   * tableau associatif retournant pour une année donnée, la vitesse du transport le plus rapide
   */
  let maximumSpeed: ISpeedPerYear = {};
  /**
   * [[ITransportCodeItem]] has a [[speed]] and [[year]]
   */
  interface ITransportCodeItem {
    speed: number;
    year: number;
  }
  /**
   * Interface ayant pour attributs le nom du transport considéré et son tableau
   * de vitesses. Ce tableau associe à une année la vitesse (dans la limite de
   * la fenêtre temporelle décrite dans le fichier csv initial) du mode de transport.
   */
  interface ITabSpeedPertransportPerYearItem {
    tabSpeed: { [year: string]: number };
    name: string;
  }
  interface ILookupCache {
    end?: IEndCityLine;
    pointP: Cartographic;
    pointQ: Cartographic;
    middle: Cartographic;
    theta: number;
  }
  let roadCode: number, roadBegin: number;
  _transportName = { lines: [], cones: [] };
  /**
   * Tableau associatif liant un mode de transport à un un objet de type [[ITabSpeedPertransportPerYearItem]]
   */
  let speedPerTransportPerYear: { [transportCode: string]: ITabSpeedPertransportPerYearItem } = {};
  /**
   * pour chaque mode de transport:
   *  - on détermine si c'est de type terrestrev(cône) ou aérien (lignes)
   *  - la fenêtre temporelle du mode de transport
   *  - le tableau de vitesse du mode de transport considéré.
   *    La formule d'interpolation utilisées pour constituée ce tableau retourne
   *    pour chaque année de la fenêtre temporelle précédemment calculée
   *    une vitesse interpolée linéairement entre deux dates où la vitesse était connue.
   *  À la sortie de cette boucle, [[speedPerTransportPerYear]]  et [[maximumSpeed]] sont renseignés
   */
  transportModeCode.forEach((transportMode) => {
    let transportCode = transportMode.code;
    let transportName = transportMode.name;
    if (transportName === 'Road') {
      roadCode = transportCode;
      roadBegin = Math.max(transportMode.yearBegin, minYear);
    }
    let transportType = transportMode.terrestrial === true ? 'cones' : 'lines';
    _transportName[transportType].push(transportName);
    let minYearTransport = Math.max(transportMode.yearBegin, minYear);
    let maxYearTransport = transportMode.yearEnd !== undefined ? transportMode.yearEnd : actualYear;
    let tempTransportCodeTab: ITransportCodeItem[] = [], tabSpeed: { [year: string]: number } = {};
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
    let extrapolation = extrapolator(tempTransportCodeTab, 'year', 'speed', true);
    let speed: number;
    for (let year = minYearTransport; year <= maxYearTransport; year++) {
      speed = extrapolation(year);
      tabSpeed[year] = speed;
      if (maximumSpeed.hasOwnProperty(year)) {
        if (maximumSpeed[year] < speed) {
          maximumSpeed[year] = speed;
        }
      } else {
        maximumSpeed[year] = speed;
      }
    }
    speedPerTransportPerYear[transportCode] = { tabSpeed: tabSpeed, name: transportName };
  });

  _minYear = minYear;
  _maxYear = maxYear;
  // faire lookup des cartographic/referential par citycode. OK
  let lookupPosition: { [cityCode: string]: NEDLocal } = {};
  let lookupMiddle: { [cityCodeBegin: number]: { [cityCodeEnd: number]: ILookupCache } } = {};
  cities.forEach((city) => {
    let position = new Cartographic(city.longitude, city.latitude, 0, false);
    lookupPosition[city.cityCode] = new NEDLocal(position);
  });
  /**
   * fonction mettant en cache les calculs d'ouverture angulaire entre deux villes (l'ordre des villes n'a pas d'importance)
   * @param  begin code de la ville de début
   * @param  end   code de la ville de fin
   * @return       retourne le résultat des calculs prenant en compte les deux villes
   * en entrée (ouverture angulaire, points P et Q et point milieu)
   */
  function cachedGetTheMiddle(begin: number, end: number): ILookupCache {
    let res = <ILookupCache>{};
    res.end = { cityCode: end, position: lookupPosition[end].cartoRef };
    if (lookupMiddle.hasOwnProperty(begin)) {
      if (!lookupMiddle[begin].hasOwnProperty(end)) {
        let { middle, theta } = getTheMiddle(lookupPosition[begin].cartoRef, lookupPosition[end].cartoRef);
        let pointP = getTheMiddle(lookupPosition[begin].cartoRef, middle).middle;
        let pointQ = getTheMiddle(middle, lookupPosition[end].cartoRef).middle;
        lookupMiddle[begin][end] = { pointP: pointP, pointQ: pointQ, middle: middle, theta: theta };
        if (!lookupMiddle.hasOwnProperty(end)) {
          lookupMiddle[end] = {};
        }
        lookupMiddle[end][begin] = { pointP: pointQ, pointQ: pointP, middle: middle, theta: theta };
      }
    } else {
      let { middle, theta } = getTheMiddle(lookupPosition[begin].cartoRef, lookupPosition[end].cartoRef);
      let pointP = getTheMiddle(lookupPosition[begin].cartoRef, middle).middle;
      let pointQ = getTheMiddle(middle, lookupPosition[end].cartoRef).middle;
      lookupMiddle[begin] = {};
      lookupMiddle[begin][end] = { pointP: pointP, pointQ: pointQ, middle: middle, theta: theta };
      if (!lookupMiddle.hasOwnProperty(end)) {
        lookupMiddle[end] = {};
      }
      lookupMiddle[end][begin] = { pointP: pointQ, pointQ: pointP, middle: middle, theta: theta };
    }
    let cached = lookupMiddle[begin][end];
    res.middle = cached.middle;
    res.theta = cached.theta;
    res.pointQ = cached.pointQ;
    res.pointP = cached.pointP;
    return res;
  }

  let processedCities: { [begin: string]: { [end: string]: string[] } } = {};
  // second part of the function
  cities.forEach((city) => {
    let originCityCode = city.cityCode;
    let referential = lookupPosition[originCityCode];
    if (!processedCities.hasOwnProperty(originCityCode)) {
      processedCities[originCityCode] = {}; // creates an empty property for 'originCityCode'
    }
    if (referential instanceof NEDLocal) {
      let beginPoint: IEndCityLine = { cityCode: originCityCode, position: referential.cartoRef };
      let listDestinations: { [cityCodeEnd: string]: ILookupEdgeList } = {};
      let transportsAlpha: ILookupTransportAlpha = {};
      let destinations: ILookupDestination = {};
      let destinationCityCode: number;
      let edge: ITransportNetwork, minYear: number, maxYear: number, alpha: number;
      let speedMax: number, speedAmb: number;
      let isTerrestrial: boolean;
      let transportName: string, tabTransportModeSpeed: ITabSpeedPertransportPerYearItem;
      if (city.edges.length === 0) {
        city.edges.push({ yearBegin: minYear, idDes: -Infinity, transportMode: roadCode });
      }
      for (let i = 0; i < city.edges.length; i++) {
        edge = city.edges[i];
        destinationCityCode = edge.idDes;
        tabTransportModeSpeed = speedPerTransportPerYear[edge.transportMode];
        if (!processedCities.hasOwnProperty(destinationCityCode)) {
          processedCities[destinationCityCode] = {}; // creates an empty property for 'destinationCityCode'
        }
        if (!processedCities[originCityCode].hasOwnProperty(destinationCityCode)) {
          processedCities[originCityCode][destinationCityCode] = []; // o-d edge
          processedCities[destinationCityCode][originCityCode] = []; // d-o edge
        }
        if (lookupPosition.hasOwnProperty(destinationCityCode)) {
          minYear = Math.min(edge.yearBegin, minYear);
          maxYear = edge.yearEnd ? edge.yearEnd : maxYear;
          if (tabTransportModeSpeed !== undefined) {
            transportName = tabTransportModeSpeed.name;
            isTerrestrial = _transportName.cones.indexOf(transportName) !== -1;
            if (!transportsAlpha.hasOwnProperty(transportName)) {
              transportsAlpha[transportName] = {};
            }
            if (!destinations.hasOwnProperty(destinationCityCode)) {
              destinations[destinationCityCode] = {};
            }
            if (!destinations[destinationCityCode].hasOwnProperty(transportName)) {
              destinations[destinationCityCode][transportName] = [];
            }
            let tabModeSpeed = tabTransportModeSpeed.tabSpeed;
            let lineToBeProcessed = processedCities[originCityCode][destinationCityCode].indexOf(transportName) === -1;
            processedCities[originCityCode][destinationCityCode].push(transportName);
            processedCities[destinationCityCode][originCityCode].push(transportName);
            for (let year = minYear; year <= maxYear; year++) {
              if (isTerrestrial === true) {
                speedMax = maximumSpeed[year];
                speedAmb = tabModeSpeed[year];
                // this is [equation 1](http://bit.ly/2tLfehC)
                // of the slope of the cone
                // executed because transport mode [[isTerrestrial]]
                alpha = Math.atan(Math.sqrt(
                  (speedMax / speedAmb) * (speedMax / speedAmb) - 1));
                if (alpha < 0) {
                  alpha += CONFIGURATION.TWO_PI;
                }
                transportsAlpha[transportName][year] = alpha;
                destinations[destinationCityCode][transportName].push({ year: year, speed: tabModeSpeed[year] });
              } else {
                if (lineToBeProcessed === true) {
                  let { end, middle, theta, pointP, pointQ } = cachedGetTheMiddle(originCityCode, destinationCityCode);
                  let ratio = getRatio(theta, maximumSpeed[year], tabModeSpeed[year]);
                  if (!listDestinations.hasOwnProperty(destinationCityCode)) {
                    listDestinations[destinationCityCode] = <ILookupEdgeList>{};
                    listDestinations[destinationCityCode].end = end;
                    listDestinations[destinationCityCode].middle = middle;
                    listDestinations[destinationCityCode].pointP = pointP;
                    listDestinations[destinationCityCode].pointQ = pointQ;
                    listDestinations[destinationCityCode].theta = theta;
                    listDestinations[destinationCityCode].ratio = {};
                  }
                  if (!listDestinations[destinationCityCode].ratio.hasOwnProperty(transportName)) {
                    listDestinations[destinationCityCode].ratio[transportName] = {};
                  }
                  listDestinations[destinationCityCode].ratio[transportName][year] = ratio;
                }
              }
            }
          }
        }
        // utiliser roadCode pour remplir les routes
        if (!transportsAlpha.hasOwnProperty('Road')) {
          transportsAlpha['Road'] = {};
        }
        let tabModeSpeed = speedPerTransportPerYear[roadCode].tabSpeed;
        for (let year = roadBegin; year <= maxYear; year++) {
          speedMax = maximumSpeed[year] === undefined ? tabModeSpeed[year] : maximumSpeed[year];
          speedAmb = tabModeSpeed[year];
          // this is [equation 1](http://bit.ly/2tLfehC)
          // of the slope of the cone
          alpha = Math.atan(Math.sqrt(
            // (maxSpeed / tabModeSpeed[year]) * (maxSpeed / tabModeSpeed[year]) - 1));
            (speedMax / speedAmb) * (speedMax / speedAmb) - 1));
          if (alpha < 0) {
            alpha += CONFIGURATION.TWO_PI;
          }
          transportsAlpha['Road'][year] = alpha;
        }

        resultat[originCityCode] = {
          referential: referential, transportsAlpha: transportsAlpha,
          destinations: destinations, cityProperties: city,
        };
        if (Object.keys(listDestinations).length > 0) {
          lineData[originCityCode] = { begin: beginPoint, list: listDestinations };
        }
      }
    }
  });
  return { lookupCityTransport: resultat, lineData: lineData };
}

export class Merger {
  private _cities: ICity[] = [];
  private _populations: IPopulation[] = [];
  private _transportModeSpeed: ITransportModeSpeed[] = [];
  private _transportModeCode: ITransportModeCode[] = [];
  private _transportNetwork: ITransportNetwork[] = [];
  private _state: IMergerState = 'missing';
  private _mergedData: ILookupAndMaxSpeedAndLine = <ILookupAndMaxSpeedAndLine>{};

  public get state(): IMergerState {
    return this._state;
  }
  public get mergedData(): ILookupAndMaxSpeedAndLine {
    return this._mergedData;
  }

  public get Cities(): ICity[] { return this._cities; }
  public CitiesByIndex(index: string | number): ICity { return this._cities[index]; }

  public get datas(): ILookupAndMaxSpeedAndLine {
    return this._mergedData;
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
    this._mergedData = <ILookupAndMaxSpeedAndLine>{};
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
        this[name].forEach((item: ITransportModeCode | ITransportNetwork) => {
          if (item.yearEnd === undefined || item.yearEnd.toString() === '') {
            delete item.yearEnd;
          }
        });
      }
      this._checkState();
    } else {
      throw new Error('scheme unknown');
    }
  }

  public merge(): void {
    if (this._state === 'ready') {
      this._state = 'pending';
      let cities: ICity[] = JSON.parse(JSON.stringify(this._cities), reviver);
      let population: IPopulation[] = JSON.parse(JSON.stringify(this._populations), reviver);
      let transportModeCode: ITransportModeCode[] = JSON.parse(JSON.stringify(this._transportModeCode), reviver);
      let transportModeSpeed: ITransportModeSpeed[] = JSON.parse(JSON.stringify(this._transportModeSpeed), reviver);
      let transportNetwork: ITransportNetwork[] = JSON.parse(JSON.stringify(this._transportNetwork), reviver);

      merger(transportModeCode, transportModeSpeed, 'code', 'transportModeCode', 'speeds', true, true, false);
      //    merger(transportNetwork, transportModeCode, 'transportModeSpeed', 'code', 'transportDetails', false, false, false);
      merger(cities, population, 'cityCode', 'cityCode', 'populations', false, true, false);
      merger(transportNetwork, cities, 'idDes', 'cityCode', 'destination', false, false, false);
      merger(cities, transportNetwork, 'cityCode', 'idOri', 'destinations', true, true, false);
      this._mergedData = toCityTransport(transportModeCode, cities, transportNetwork);
      // console.log(cities, transportModeCode, transportNetwork, this._mergedData);
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
        if (Object.keys(this._mergedData).length > 0) {
          state = 'complete';
        }
      }
      this._state = state;
    }
  }

}
