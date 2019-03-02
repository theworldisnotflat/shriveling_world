/**
 * in merger are the functions used only once
 * which are CPU/GPU intensive functions
 * and which compute the geometry of cones and edges.
 * the functions that must run everytime a parameter is modified
 * are located in the respective files for cones and edges
 *
 */
'use strict';
import * as Papa from 'papaparse';
import { NEDLocal } from '../common/referential';
import { extrapolator, Cartographic, reviver } from '../common/utils';
import {
    ITransportModeCode, ICity, ITransportNetwork, ILookupCityTransport, ILookupTransport, IMergerState,
    ILookupDestination, IPopulation, ITransportModeSpeed, ILookupAndMaxSpeedAndLine, ILookupLine, IEndTownLine,
    ILookupItemList,
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

const keyWords: { name: string, words: string[] }[] = [
    { name: '_cities', words: ['cityCode', 'latitude', 'longitude', 'radius'] },
    { name: '_transportModeSpeed', words: ['transportModeCode', 'year', 'speedKPH'] },
    { name: '_transportModeCode', words: ['code', 'name', 'yearBegin', 'terrestrial'] },
    { name: '_transportNetwork', words: ['transportMode', 'idDes', 'idOri'] },
    { name: '_populations', words: ['cityCode'] },
];

// "thetaLimit" = threshold angle of the modelled air services speed:
// - beyond "thetaLimit" speed has the constant value "speed"
// - below "thetaLimit" speed decreases from value "speed" to zero depending on the value of "theta"
const thetaLimit = 2000 / ( CONFIGURATION.earthRadiusMeters / 1000);
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
 * @returns {{ middle: Cartographic, opening: number }}
 */
function getTheMiddle(posA: Cartographic, posB: Cartographic)
    : { middle: Cartographic, opening: number } {
    const theta = posA.exactDistance(posB);
    const semiTheta = theta / 2;
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
    return { middle: resultat, opening: theta };
}

/**
 * getRatio function computes the speed ratio
 *
 * In the case of air edges, two equations are used to determine
 * the [heigth of aerial edges above the geodesic](http://bit.ly/2H4FOKw)
 * * [below](http://bit.ly/2Xu3kGF) and
 * * [beyond](http://bit.ly/2EejFpW)
 * the threshold value "thetaLimit" of "theta"
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
 *
 * About the [geometry of cones see here](https://timespace.hypotheses.org/121)
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
    let speedMaxPerYear: ISpeedPerYear = {};
    /**
     * [[ITransportCodeItem]] has a [[speed]] and [[year]]
     */
    interface ITransportCodeItem {
        speed: number;
        year: number;
    }
    /**
     * [[ISpeedPertransportPerYearItem]] has a [[tabSpeed]] and a [[name]]
     */
    interface ISpeedPertransportPerYearItem {
        tabSpeed: { [year: string]: number };
        name: string;
    }
    interface ILookupCache {
        end?: IEndTownLine;
        pointP: Cartographic;
        pointQ: Cartographic;
        middle: Cartographic;
        opening: number;
    }
    let roadCode: number, roadBegin: number;
    _transportName = { lines: [], cones: [] };
    let speedPerTransportPerYear: { [transportCode: string]: ISpeedPertransportPerYearItem } = {};
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
            if (speedMaxPerYear.hasOwnProperty(year)) {
                if (speedMaxPerYear[year] < speed) {
                    speedMaxPerYear[year] = speed;
                }
            } else {
                speedMaxPerYear[year] = speed;
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

    function cachedGetTheMiddle(begin: number, end: number): ILookupCache {
        let res = <ILookupCache>{};
        res.end = { cityCode: end, position: lookupPosition[end].cartoRef };
        if (lookupMiddle.hasOwnProperty(begin)) {
            if (!lookupMiddle[begin].hasOwnProperty(end)) {
                let { middle, opening } = getTheMiddle(lookupPosition[begin].cartoRef, lookupPosition[end].cartoRef);
                let pointP = getTheMiddle(lookupPosition[begin].cartoRef, middle).middle;
                let pointQ = getTheMiddle(middle, lookupPosition[end].cartoRef).middle;
                lookupMiddle[begin][end] = { pointP: pointP, pointQ: pointQ, middle: middle, opening: opening };
                if (!lookupMiddle.hasOwnProperty(end)) {
                    lookupMiddle[end] = {};
                }
                lookupMiddle[end][begin] = { pointP: pointQ, pointQ: pointP, middle: middle, opening: opening };
            }
        } else {
            let { middle, opening } = getTheMiddle(lookupPosition[begin].cartoRef, lookupPosition[end].cartoRef);
            let pointP = getTheMiddle(lookupPosition[begin].cartoRef, middle).middle;
            let pointQ = getTheMiddle(middle, lookupPosition[end].cartoRef).middle;
            lookupMiddle[begin] = {};
            lookupMiddle[begin][end] = { pointP: pointP, pointQ: pointQ, middle: middle, opening: opening };
            if (!lookupMiddle.hasOwnProperty(end)) {
                lookupMiddle[end] = {};
            }
            lookupMiddle[end][begin] = { pointP: pointQ, pointQ: pointP, middle: middle, opening: opening };
        }
        let cached = lookupMiddle[begin][end];
        res.middle = cached.middle;
        res.opening = cached.opening;
        res.pointQ = cached.pointQ;
        res.pointP = cached.pointP;
        return res;
    }
    let processedCities: { [begin: string]: { [end: string]: string[] } } = {};
    cities.forEach((city) => {
        let originCityCode = city.cityCode;
        let referential = lookupPosition[originCityCode];
        if (!processedCities.hasOwnProperty(originCityCode)) {
            processedCities[originCityCode] = {};
        }
        if (referential instanceof NEDLocal) {
            let beginPoint: IEndTownLine = { cityCode: originCityCode, position: referential.cartoRef };
            let list: { [cityCodeEnd: string]: ILookupItemList } = {};
            let transports: ILookupTransport = {};
            let destinations: ILookupDestination = {};
            let codeDestination: number;
            let edge: ITransportNetwork, min: number, max: number, bearing: number, elevation: number, elevationDegree: number;
            let isTerrestrial: boolean;
            let transportName: string, transportMode: ISpeedPertransportPerYearItem;
            if (city.destinations.length === 0) {
                city.destinations.push({ yearBegin: minYear, idDes: -Infinity, transportMode: roadCode });
            }
            for (let i = 0; i < city.destinations.length; i++) {
                edge = city.destinations[i];
                codeDestination = edge.idDes;
                transportMode = speedPerTransportPerYear[edge.transportMode];
                if (!processedCities.hasOwnProperty(codeDestination)) {
                    processedCities[codeDestination] = {};
                }
                if (!processedCities[originCityCode].hasOwnProperty(codeDestination)) {
                    processedCities[originCityCode][codeDestination] = [];
                    processedCities[codeDestination][originCityCode] = [];
                }
                if (lookupPosition.hasOwnProperty(codeDestination)) {
                    min = Math.max(edge.yearBegin, minYear);
                    max = edge.yearEnd ? edge.yearEnd : maxYear;
                    if (transportMode !== undefined) {
                        transportName = transportMode.name;
                        isTerrestrial = _transportName.cones.indexOf(transportName) !== -1;
                        if (!transports.hasOwnProperty(transportName)) {
                            transports[transportName] = {};
                        }
                        if (!destinations.hasOwnProperty(codeDestination)) {
                            destinations[codeDestination] = {};
                        }
                        if (!destinations[codeDestination].hasOwnProperty(transportName)) {
                            destinations[codeDestination][transportName] = [];
                        }
                        let tab = transportMode.tabSpeed;
                        let lineToProcess = processedCities[originCityCode][codeDestination].indexOf(transportName) === -1;
                        processedCities[originCityCode][codeDestination].push(transportName);
                        processedCities[codeDestination][originCityCode].push(transportName);
                        for (let year = min; year <= max; year++) {
                            if (isTerrestrial === true) {
                                elevation = Math.atan(Math.sqrt(
                                    (speedMaxPerYear[year] / tab[year]) * (speedMaxPerYear[year] / tab[year]) - 1));
                                if (elevation < 0) {
                                    elevation += CONFIGURATION.TWO_PI;
                                }
                                elevationDegree = elevation / CONFIGURATION.deg2rad;
                                transports[transportName][year] = {
                                    clock: bearing, elevation: elevation, speed: tab[year],
                                    clockDegree: bearing / CONFIGURATION.deg2rad,
                                    elevationDegree: elevationDegree,
                                    destination: codeDestination,
                                    transport: transportName,
                                    year: year,
                                };
                                destinations[codeDestination][transportName].push({ year: year, speed: tab[year] });
                            } else {
                                if (lineToProcess === true) {
                                    let { end, middle, opening, pointP, pointQ } = cachedGetTheMiddle(originCityCode, codeDestination);
                                    let ratio = getRatio(opening, speedMaxPerYear[year], tab[year]);
                                    // just a test
                                    // ratio = ratio - ( CONFIGURATION.earthRadiusMeters / 1000);
                                    if (!list.hasOwnProperty(codeDestination)) {
                                        list[codeDestination] = <ILookupItemList>{};
                                        list[codeDestination].end = end;
                                        list[codeDestination].middle = middle;
                                        list[codeDestination].pointP = pointP;
                                        list[codeDestination].pointQ = pointQ;
                                        list[codeDestination].opening = opening;
                                        list[codeDestination].ratio = {};
                                        // for testing
                                        console.log(ratio, opening, speedMaxPerYear[year], tab[year]);
                                    }
                                    if (!list[codeDestination].ratio.hasOwnProperty(transportName)) {
                                        list[codeDestination].ratio[transportName] = {};
                                    }
                                    list[codeDestination].ratio[transportName][year] = ratio;
                                }
                            }
                        }
                    }
                }
                // utiliser roadCode pour remplir les routes
                if (!transports.hasOwnProperty('Road')) {
                    transports['Road'] = {};
                }
                let tab = speedPerTransportPerYear[roadCode].tabSpeed;
                let maxSpeed: number;
                for (let year = roadBegin; year <= maxYear; year++) {
                    maxSpeed = speedMaxPerYear[year] === undefined ? tab[year] : speedMaxPerYear[year];
                    elevation = Math.atan(Math.sqrt(
                        (maxSpeed / tab[year]) * (maxSpeed / tab[year]) - 1));
                    if (elevation < 0) {
                        elevation += CONFIGURATION.TWO_PI;
                    }
                    elevationDegree = elevation / CONFIGURATION.deg2rad;
                    transports['Road'][year] = {
                        clock: 0, elevation: elevation, speed: tab[year],
                        clockDegree: 0, elevationDegree: elevationDegree, transport: 'Road', year: year,
                    };
                }

                resultat[originCityCode] = {
                    referential: referential, transports: transports,
                    destinations: destinations, cityProperties: city,
                };
                if (Object.keys(list).length > 0) {
                    lineData[originCityCode] = { begin: beginPoint, list: list };
                }
            }
        }
    });
    return { lookupTownTransport: resultat, lineData: lineData };
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

    public get Cities(): ICity[] {return this._cities; }
    public CitiesByIndex(index): ICity {return this._cities[index]; }

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
        let name, temp, ok;
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
                this[name].forEach(item => {
                    if (item.yearEnd === undefined || item.yearEnd === '') {
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
            //    merger(transportNetwork, transportModeCode, 'transportMode', 'code', 'transportDetails', false, false, false);
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
