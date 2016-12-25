namespace shriveling {
    'use strict';

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

    /* tslint:disable */
    let iso8601RegExp = /(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))/;
    /* tslint:enable */

    function jsonDataParse(key, value): any {
        if (typeof value === 'string') {
            let temp = value.replace(' ', '');
            if (iso8601RegExp.exec(temp)) {
                value = new Date(temp);
            }
        }
        return value;
    }
    const keyWords: { name: string, words: string[] }[] = [
        { name: '_cities', words: ['cityCode', 'latitude', 'longitude', 'radius'] },
        { name: '_transportModeSpeed', words: ['transportModeCode', 'year', 'speedKPH'] },
        { name: '_transportModeCode', words: ['code', 'name', 'yearBegin'] },
        { name: '_transportNetwork', words: ['transportMode', 'idDes', 'idOri'] },
        { name: '_populations', words: ['cityCode'] },
    ];

    const config: PapaParse.ParseConfig = {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        fastMode: true,
    };

    function getCSV(text: string): any {
        return Papa.parse(text, config).data;
    }

    export type IMergerState = 'missing' | 'ready' | 'pending' | 'complete';

    function toTownTransport(
        transportModeCode: ITransportModeCode[], cities: ICity[], transportNetwork: ITransportNetwork[]): IlookupTownTransport {
        let resultat: IlookupTownTransport = {};
        // déterminer la fourchette de temps considéré OK
        let minYear = (new Date()).getFullYear(), maxYear = minYear;
        transportNetwork.forEach((item) => {
            if (minYear > item.yearBegin) {
                minYear = item.yearBegin;
            }
        });
        // déterminer pour chaque type de transport la vitesse par an dans la fourchette + vitesse max par an de la fourchette OK
        interface ISpeedPerYear {
            [year: string]: number;
        }
        let speedMaxPerYear: ISpeedPerYear = {};
        interface ITransportCodeItem {
            speed: number;
            year: number;
        }
        interface ISpeedPertransportPerYearItem {
            tabSpeed: { [year: string]: number };
            name: string;
        }
        let speedPerTransportPerYear: { [transportCode: string]: ISpeedPertransportPerYearItem } = {};
        transportModeCode.forEach((transportMode) => {
            let transportCode = transportMode.code;
            let transportName = transportMode.name;
            let tempTransportCodeTab: ITransportCodeItem[] = [], tabSpeed: { [year: string]: number } = {};
            transportMode.speeds.forEach((transportSpeed) => {
                tempTransportCodeTab.push({ speed: transportSpeed.speedKPH, year: transportSpeed.year });
            });
            tempTransportCodeTab = tempTransportCodeTab.sort((a, b) => a.year - b.year);
            let extrapolation = extrapolator(tempTransportCodeTab, 'year', 'speed');
            let speed: number;
            for (let year = minYear; year <= maxYear; year++) {
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
        // faire lookup des cartographic/referential par citycode. OK
        let lookupPosition: { [cityCode: string]: NEDLocal } = {};
        cities.forEach((city) => {
            let position = new Cartographic(city.longitude, city.latitude, 0, false);
            lookupPosition[city.cityCode] = new NEDLocal(position);
        });
        cities
            .filter((city) => city.destinations.length > 0)
            .forEach((city) => {
                let cacheBearing: { [cityCode: string]: number } = {};
                let originCityCode = city.cityCode;
                let referential = lookupPosition[originCityCode];
                if (referential instanceof NEDLocal) {
                    let transports: ILookupTransport = {};
                    let destinations: ILookupDestination = {};
                    let lookupTransport: ILookupTransport, codeDestination: number, posDestination: Cartographic;
                    let edge: ITransportNetwork, min: number, max: number, bearing: number, elevation: number;
                    let transportName: string, transportMode: ISpeedPertransportPerYearItem;
                    for (let i = 0; i < city.destinations.length; i++) {
                        edge = city.destinations[i];
                        min = Math.max(edge.yearBegin, minYear);
                        max = edge.yearEnd ? edge.yearEnd : maxYear;
                        codeDestination = edge.idDes;
                        transportMode = speedPerTransportPerYear[edge.transportMode];
                        if (cacheBearing.hasOwnProperty(codeDestination)) {
                            bearing = cacheBearing[codeDestination];
                        } else {
                            if (lookupPosition.hasOwnProperty(codeDestination)) {
                                bearing = referential.getClock(lookupPosition[codeDestination].cartoRef);
                                cacheBearing[codeDestination] = bearing;
                            } else {
                                bearing = undefined;
                            }
                        }
                        if (bearing !== undefined && transportMode !== undefined) {
                            transportName = transportMode.name;
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
                            for (let year = min; year <= max; year++) {
                                if (!transports[transportName].hasOwnProperty(year)) {
                                    transports[transportName][year] = [];
                                }
                                elevation = Math.atan(Math.sqrt(
                                    (speedMaxPerYear[year] / tab[year]) * (speedMaxPerYear[year] / tab[year]) - 1));
                                transports[transportName][year].push({ clock: bearing, elevation: elevation });
                                destinations[codeDestination][transportName].push({ year: year, speed: tab[year] });
                            }
                        }
                    }
                    for (let transport in transports) {
                        if (transports.hasOwnProperty(transport)) {
                            for (let year in transports[transport]) {
                                if (transports[transport].hasOwnProperty(year)) {
                                    transports[transport][year] = transports[transport][year].sort((a, b) => a.clock - b.clock);
                                }
                            }
                        }
                    }

                    resultat[originCityCode] = { referential: referential, transports: transports, destinations: destinations };
                }
            });
        // todo add road cones??
        return resultat;
    }

    export class Merger {
        private _cities: ICity[] = [];
        private _populations: IPopulation[] = [];
        private _transportModeSpeed: ITransportModeSpeed[] = [];
        private _transportModeCode: ITransportModeCode[] = [];
        private _transportNetwork: ITransportNetwork[] = [];
        private _state: IMergerState = 'missing';
        private _mergedData: IlookupTownTransport = {};

        get state(): IMergerState {
            return this._state;
        }

        get datas(): IlookupTownTransport {
            return this._mergedData;
        }

        public clear(): void {
            this._cities = [];
            this._populations = [];
            this._transportModeSpeed = [];
            this._transportModeCode = [];
            this._transportNetwork = [];
            this._mergedData = {};
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
                this[name].push(...getCSV(someString));
                if (name === '_transportModeCode' || name === '_transportNetwork') {
                    this[name].forEach((item) => {
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
                let cities: ICity[] = JSON.parse(JSON.stringify(this._cities), jsonDataParse);
                let population: IPopulation[] = JSON.parse(JSON.stringify(this._populations), jsonDataParse);
                let transportModeCode: ITransportModeCode[] = JSON.parse(JSON.stringify(this._transportModeCode), jsonDataParse);
                let transportModeSpeed: ITransportModeSpeed[] = JSON.parse(JSON.stringify(this._transportModeSpeed), jsonDataParse);
                let transportNetwork: ITransportNetwork[] = JSON.parse(JSON.stringify(this._transportNetwork), jsonDataParse);

                merger(transportModeCode, transportModeSpeed, 'code', 'transportModeCode', 'speeds', true, true, false);
                //    merger(transportNetwork, transportModeCode, 'transportMode', 'code', 'transportDetails', false, false, false);
                merger(cities, population, 'cityCode', 'cityCode', 'populations', false, true, false);
                merger(transportNetwork, cities, 'idDes', 'cityCode', 'destination', false, false, false);
                merger(cities, transportNetwork, 'cityCode', 'idOri', 'destinations', true, true, false);

                this._mergedData = toTownTransport(transportModeCode, cities, transportNetwork);
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
}
