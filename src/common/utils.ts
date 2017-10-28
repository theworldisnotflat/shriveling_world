namespace shriveling {
    'use strict';

    export var mapProjectors: IConverterLookup = {
        none:
        {
            converter: (
                pos: Cartographic, toPack: boolean,
                threeRadius: number = Cartographic.THREE_EARTH_RADIUS): THREE.Vector3 | number[] => {
                let radius = (Configuration.earthRadiusMeters + pos.height) / Configuration.earthRadiusMeters * threeRadius;
                let x = -Math.cos(pos.longitude) * radius * Math.cos(pos.latitude);
                let y = Math.sin(pos.latitude) * radius;
                let z = Math.sin(pos.longitude) * radius * Math.cos(pos.latitude);
                return toPack === true ? [x, y, z] : new THREE.Vector3(x, y, z);
            },
            reverser: (pos: THREE.Vector3, threeRadius: number = Cartographic.THREE_EARTH_RADIUS): Cartographic => {
                let radius = pos.length();
                let resultat = new Cartographic();
                resultat.height = (radius * Configuration.earthRadiusMeters / threeRadius) - Configuration.earthRadiusMeters;
                resultat.longitude = Math.atan2(pos.z, -pos.x);
                let cos = Math.cos(resultat.longitude);
                let sin = Math.sin(resultat.longitude);
                if (Math.abs(sin) > 1e-13) {
                    resultat.latitude = Math.atan2(pos.y, pos.z / sin);
                } else if (Math.abs(cos) > 1e-13) {
                    resultat.latitude = Math.atan2(pos.y, pos.x / cos);
                } else {
                    resultat.latitude = Math.asin(pos.y);
                }
                return resultat;
            },
        },
        /*  Equirectangular:
          {
              converter: (
                  pos: Cartographic, toPack: boolean, reference = new Cartographic(),
                  threeRadius: number = Cartographic.THREE_EARTH_RADIUS): THREE.Vector3 | number[] => {
                  let x = (pos.longitude - reference.longitude) * Math.cos(reference.latitude) * threeRadius;
                  let y = (pos.latitude - reference.latitude) * threeRadius;
                  let z = (pos.height - reference.height) / Configuration.earthRadiusMeters * threeRadius;
                  return toPack === true ? [x, y, z] : new THREE.Vector3(x, y, z);
              },
              reverser: (
                  pos: THREE.Vector3, reference = new Cartographic(),
                  threeRadius: number = Cartographic.THREE_EARTH_RADIUS): Cartographic => {
                  let cleanPos = pos.clone().multiplyScalar(1 / threeRadius);
                  let resultat = new Cartographic();
                  resultat.height = cleanPos.z * Configuration.earthRadiusMeters + reference.height;
                  resultat.latitude = cleanPos.x + reference.latitude;
                  let cos = Math.cos(resultat.latitude);
                  if (cos > 1e-13) {
                      resultat.longitude = cleanPos.x / cos + reference.longitude;
                  }
                  return resultat;
              },
          },
          Mercator:
          {
              converter: (
                  pos: Cartographic, toPseudo: boolean, lambda0: number = 0,
                  threeRadius: number = Cartographic.THREE_EARTH_RADIUS): THREE.Vector3 | number[] => {
                  let x = (pos.longitude - lambda0) * threeRadius;
                  let y = Math.log(Math.tan(Math.PI / 4 + pos.latitude / 2)) * threeRadius;
                  let z = pos.height / Configuration.earthRadiusMeters * threeRadius;
                  return toPseudo === true ? [x, y, z] : new THREE.Vector3(x, y, z);
              },
              reverser: (
                  pos: THREE.Vector3, lambda0: number = 0,
                  threeRadius: number = Cartographic.THREE_EARTH_RADIUS): Cartographic => {
                  let cleanPos = pos.clone().multiplyScalar(1 / threeRadius);
                  let resultat = new Cartographic();
                  resultat.longitude = cleanPos.x + lambda0;
                  resultat.height = cleanPos.z + Configuration.earthRadiusMeters;
                  resultat.latitude = 2 * (Math.atan(Math.exp(cleanPos.y)) - Math.PI / 4);
                  return resultat;
              },
          },*/
    };

    export class Cartographic {
        public static THREE_EARTH_RADIUS: number = 100;

        public latitude: number;
        public longitude: number;
        public height: number;

        public static distanceApproximee(pos1: Cartographic, pos2: Cartographic): number {
            let x = (pos1.longitude - pos2.longitude) * Math.cos((pos1.latitude + pos2.latitude) / 2);
            let y = pos1.latitude - pos2.latitude;
            return Math.sqrt(x * x + y * y);
        }

        public static distanceExacte(pos1: Cartographic, pos2: Cartographic): number {
            let resultat = Math.sin(pos1.latitude) * Math.sin(pos2.latitude);
            resultat += Math.cos(pos1.latitude) * Math.cos(pos2.latitude) * Math.cos(pos2.longitude - pos1.longitude);
            return Math.acos(resultat);
        }

        public static isInside(position: Cartographic, boundary: Cartographic[]): boolean {
            let cn = 0;    // the  crossing number counter
            let iplus: number, n = boundary.length;
            // loop through all edges of the polygon
            for (let i = 0; i < n; i++) {    // edge from V[i]  to V[i+1]
                iplus = (i === n - 1) ? 0 : i + 1;
                if (((boundary[i].latitude <= position.latitude) && (boundary[iplus].latitude > position.latitude))
                    || ((boundary[i].latitude > position.latitude) && (boundary[iplus].latitude <= position.latitude))) {
                    let vt = (position.latitude - boundary[i].latitude) / (boundary[iplus].latitude - boundary[i].latitude);
                    if (position.longitude < boundary[i].longitude + vt * (boundary[iplus].longitude - boundary[i].longitude)) {
                        cn++;
                    }
                }
            }
            return cn % 2 === 1;    // 0 if even (out), and 1 if  odd (in)
        }

        public static lerp(pos1: Cartographic, pos2: Cartographic, fractions: number[] = []): Cartographic[] {
            let distance = Cartographic.distanceExacte(pos1, pos2);
            let resultat: Cartographic[] = [];
            if (distance > 0) {
                fractions.forEach((fraction) => {
                    let A = Math.sin((1 - fraction) * distance) / Math.sin(distance);
                    let B = Math.sin(fraction * distance) / Math.sin(distance);
                    let x = A * Math.cos(pos1.latitude) * Math.cos(pos1.longitude) + B * Math.cos(pos2.latitude) * Math.cos(pos2.longitude);
                    let y = A * Math.cos(pos1.latitude) * Math.sin(pos1.longitude) + B * Math.cos(pos2.latitude) * Math.sin(pos2.longitude);
                    let z = A * Math.sin(pos1.latitude) + B * Math.sin(pos2.latitude);
                    resultat.push(new Cartographic(
                        Math.atan2(z, Math.sqrt(x * x + y * y)), Math.atan2(y, x), (1 - fraction) * pos1.height + fraction * pos2.height));
                });
            }
            return resultat;
        }

        public static direction(pos1: Cartographic, pos2: Cartographic): number {
            return Math.atan2(pos2.latitude - pos1.latitude, pos2.longitude - pos1.longitude);
        }

        public static fromVector3(pos1: THREE.Vector3, projector: string): Cartographic {
            let resultat: Cartographic;
            if (mapProjectors.hasOwnProperty(projector)) {
                resultat = mapProjectors[projector].reverser(pos1);
            } else {
                throw new Error('no projector with the name of ' + projector);
            }
            return resultat;
        }

        public static fromJSON(value: any): any {
            return Generic_fromJSON(Cartographic, value.data);
        }

        constructor(longitude: number = 0, latitude: number = 0, height: number = 0, isRadians: boolean = true) {
            if (!isRadians) {
                latitude *= Configuration.deg2rad;
                longitude *= Configuration.deg2rad;
            }
            this.latitude = latitude;
            this.longitude = longitude;
            this.height = height;
        }

        public clone(): Cartographic {
            return new Cartographic(this.longitude, this.latitude, this.height);
        }

        public distanceApproximee(pos2: Cartographic): number {
            return Cartographic.distanceApproximee(this, pos2);
        }

        public distanceExacte(pos2: Cartographic): number {
            return Cartographic.distanceExacte(this, pos2);
        }

        public lerp(pos2: Cartographic, fractions: number[] = []): Cartographic[] {
            return Cartographic.lerp(this, pos2, fractions);
        }

        public toTHREEVector3(
            nameProJections: string[] = []): { [name: string]: THREE.Vector3 } {
            if (nameProJections.length === 0) {
                nameProJections = [...Object.keys(mapProjectors)];
            }
            let that = this;
            let resultat: { [name: string]: THREE.Vector3 } = {};
            nameProJections.forEach((name) => {
                if (mapProjectors.hasOwnProperty(name)) {
                    resultat[name] = <THREE.Vector3>mapProjectors[name].converter(that, false);
                }
            });
            return resultat;
        }

        public toPack(
            nameProJections: string[] = []): { [name: string]: number[] } {
            if (nameProJections.length === 0) {
                nameProJections = [...Object.keys(mapProjectors)];
            }
            let that = this;
            let resultat: { [name: string]: number[] } = {};
            nameProJections.forEach((name) => {
                if (mapProjectors.hasOwnProperty(name)) {
                    resultat[name] = <number[]>mapProjectors[name].converter(that, true);
                }
            });
            return resultat;
        }

        public direction(pos: Cartographic): number {
            return Cartographic.direction(this, pos);
        }

        public toJSON(): { ctor: string, data: any } {
            return Generic_toJSON('Cartographic', this);
        }
    }

    export var ZERO_CARTOGRAPHIC = new Cartographic();

    Object.freeze(ZERO_CARTOGRAPHIC);

    export interface IConverter {
        converter: (pos: Cartographic, toPack: boolean) => THREE.Vector3 | number[];
        reverser: (pos: THREE.Vector3) => Cartographic;
    }

    export interface IConverterLookup {
        [name: string]: IConverter;
    }

    export interface IMapProjector {
        name: string;
        converter: (pos: Cartographic) => THREE.Vector3;
    }

    export interface IClock {
        clock: number;
    }

    export interface IDirection extends IClock {
        elevation: number;
        speed?: number;
        clockDegree?: number;
        elevationDegree?: number;
        destination?: number;
        transport?: string;
        year?: number;
    }

    export interface ILookupDirection {
        [year: string]: IDirection[];
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

    export interface ITownTransport {
        referential: NEDLocal;
        transports: ILookupTransport;
        destinations: ILookupDestination;
        cityProperties: ICity;
    }

    export interface ILookupTownTransport {
        [cityCode: string]: ITownTransport;
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

    export interface ICity {
        countryCode: number;
        countryName: string;
        cityCode: number;
        urbanagglomeration: string;
        latitude: number;
        longitude: number;
        radius: number;
        populations?: IPopulation;
        destinations?: ITransportNetwork[];
    }

    export interface ITransportModeSpeed {
        year: number;
        transportModeCode?: number;
        speedKPH: number;
    }

    export interface ITransportModeCode {
        name: string;
        code: number;
        yearBegin: number;
        yearEnd?: number;
        speeds: ITransportModeSpeed[];
    }

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

    export interface ILookupTownPseudoGeometryPremises {
        transports: { [transport: string]: ILookupPseudoGeometryPremises };
        position: Cartographic;
        cityCode: string;
        otherProperties: any;
    }

    export interface IDataConeGeneratorIn {
        lookup: ILookupTownTransport;
        bboxes: IBBox[];
        distance: number;
    }

    function updateSumupCriteriaByDateOrNumber(subObject: { max: Date | number, min: Date | number }, temp: Date | number): void {
        let comparMin = compare(subObject.min, temp, true);
        let comparMax = compare(subObject.max, temp, true);
        if (comparMin > 0) {
            subObject.min = temp;
        }
        if (comparMax < 0) {
            subObject.max = temp;
        }
    }

    export function updateSumUpCriteria(sumup: ISumUpCriteria, properties: any): ISumUpCriteria {
        let temp: any, subObject: { max: Date | number, min: Date | number };
        let comparMin: number, comparMax: number, typeofTemp: string;
        // attention si properties est un tableau
        for (let attribute in properties) {
            if (properties.hasOwnProperty(attribute)) {
                temp = properties[attribute];
                if (temp !== undefined || temp !== null) {
                    typeofTemp = typeof temp;
                    if (sumup.hasOwnProperty(attribute)) {
                        switch (typeofTemp) {
                            case 'string':
                                if (sumup[attribute].type === 'string') {
                                    if ((<string[]>sumup[attribute].sumUp).indexOf(temp) === -1) {
                                        (<string[]>sumup[attribute].sumUp).push(temp);
                                    }
                                } else {
                                    sumup[attribute].type = 'undefined';
                                    delete sumup[attribute].sumUp;
                                }
                                break;
                            case 'object':
                                if (temp instanceof Date && sumup[attribute].type === 'date') {
                                    updateSumupCriteriaByDateOrNumber(<{ max: Date, min: Date }>sumup[attribute].sumUp, temp);
                                } else if (Array.isArray(temp) && sumup[attribute].type === 'array') {
                                    temp.forEach((item) => {
                                        updateSumUpCriteria(<ISumUpCriteria>sumup[attribute].sumUp, item);
                                    });
                                } else if (sumup[attribute].type === 'object') {
                                    updateSumUpCriteria(<ISumUpCriteria>sumup[attribute].sumUp, temp);
                                } else {
                                    sumup[attribute].type = 'undefined';
                                    delete sumup[attribute].sumUp;
                                }
                                break;
                            case 'boolean':
                                if (sumup[attribute].type !== 'boolean') {
                                    sumup[attribute].type = 'undefined';
                                    delete sumup[attribute].sumUp;
                                }
                                break;
                            case 'symbol':
                                break;
                            case 'function':
                                break;
                            case 'number':
                                if (sumup[attribute].type === 'number') {
                                    updateSumupCriteriaByDateOrNumber(<{ max: number, min: number }>sumup[attribute].sumUp, temp);
                                } else {
                                    sumup[attribute].type = 'undefined';
                                    delete sumup[attribute].sumUp;
                                }
                                break;
                            default:

                        }
                    } else {
                        switch (typeofTemp) {
                            case 'string':
                                sumup[attribute] = { type: 'string', sumUp: [] };
                                (<string[]>sumup[attribute].sumUp).push(temp);
                                break;
                            case 'object':
                                if (temp instanceof Date) {
                                    sumup[attribute] = { type: 'date', sumUp: { max: temp, min: temp } };
                                } else if (Array.isArray(temp)) {
                                    sumup[attribute] = { type: 'array', sumUp: {} };
                                    temp.forEach((item) => {
                                        updateSumUpCriteria(<ISumUpCriteria>sumup[attribute].sumUp, item);
                                    });
                                } else {
                                    sumup[attribute] = { type: 'object', sumUp: {} };
                                    updateSumUpCriteria(<ISumUpCriteria>sumup[attribute].sumUp, temp);
                                }
                                break;
                            case 'boolean':
                                sumup[attribute] = { type: 'boolean' };
                                break;
                            case 'symbol':
                                break;
                            case 'function':
                                break;
                            case 'number':
                                sumup[attribute] = { type: 'number', sumUp: { max: temp, min: temp } };
                                break;
                            default:

                        }
                    }
                }
            }
        }
        return sumup;
    }

    function compare(ob1: any, ob2: any, ascendant: boolean): number {
        let resultat = 0;
        if (ob1 === undefined || ob1 === null) {
            ob1 = '';
        }
        if (ob2 === undefined || ob2 === null) {
            ob2 = '';
        }
        let ob1Float = parseFloat(ob1);
        let ob2Float = parseFloat(ob2);
        if (ob1 instanceof Date && ob2 instanceof Date) {
            resultat = ob1.getTime() - ob2.getTime();
        } else if (!isNaN(ob1Float) && !isNaN(ob2Float) &&
            (ob1.length === ob1Float.toString().length) && (ob2.length === ob2Float.toString().length)) {
            resultat = ob1Float - ob2Float;
        } else {
            let ob1String = ob1.toString().toLowerCase();
            let ob2String = ob2.toString().toLowerCase();
            if (ob1String === ob2String) {
                resultat = 0;
            } else if (ob1String > ob2String) {
                resultat = 1;
            } else {
                resultat = -1;
            }
        }
        if (!ascendant) {
            resultat = -resultat;
        }
        return resultat;
    }

    function compareItemCriteria(value: any, itemCriteria: IItemCriteria): boolean {
        let resultat = false;
        if (Array.isArray(value)) {
            value.forEach((item) => {
                resultat = resultat || compareItemCriteria(item, itemCriteria);
            });
        } else {
            let comparison = compare(value, itemCriteria.value, true);
            let comparator = itemCriteria.comparator;
            if (comparator === '>') {
                if (comparison > 0) {
                    resultat = true;
                }
            } else if (comparator === '>=') {
                if (comparison >= 0) {
                    resultat = true;
                }
            } else if (comparator === '<') {
                if (comparison < 0) {
                    resultat = true;
                }
            } else if (comparator === '<=') {
                if (comparison <= 0) {
                    resultat = true;
                }
            } else if (comparator === '!=') {
                if (comparison !== 0) {
                    resultat = true;
                }
            } else {
                // =
                if (comparison === 0) {
                    resultat = true;
                }
            }
        }
        return resultat;
    }

    function getObjectByString(objet: any, path: string): any {
        path = path.replace(/\[(\w+|\*)\]/g, '.$1'); // convert indexes to properties
        path = path.replace(/^\./, '');           // strip a leading dot
        let tab = path.split('.');
        let subAttribut = tab.shift();
        let finished = false;
        while (subAttribut !== undefined && finished === false && objet !== undefined) {
            // todo faire le même principe pour un objet quelconque!!
            if (subAttribut === '') {
                // nothing
            } else if (subAttribut === '*') {
                let subPath = tab.join('.');
                if (Array.isArray(objet)) {
                    objet = objet.map((item) => getObjectByString(item, subPath));
                    finished = true;
                } else if (typeof objet === 'object' && !(objet instanceof Date)) {
                    objet = Object.getOwnPropertyNames(objet).map((attributName) => getObjectByString(objet[attributName], subPath));
                    finished = true;
                }
            } else if (subAttribut in objet) {
                objet = objet[subAttribut];
            } else {
                objet = undefined;
            }
            subAttribut = tab.shift();
        }
        return objet;
    }

    export function searchCriterias<T>(collection: T[], criterias: ICriterias, forbiddenAttributes: string[] = [], child?: string): T[] {
        let criteriasKey = Object.keys(criterias);
        let regex = new RegExp('(' + forbiddenAttributes.join('|') + ')', 'g');
        function megaFilter(item: T): boolean {
            let found = true;
            let foundedObject: any;
            let out: any = child === undefined ? item : getObjectByString(item, child);
            let attribut: string;
            for (let i = 0; i < criteriasKey.length && found === true; i++) {
                attribut = criteriasKey[i];
                if (attribut.match(regex) === null) {
                    foundedObject = getObjectByString(out, attribut);
                    if (foundedObject === undefined) {
                        found = false;
                    } else {
                        found = found && compareItemCriteria(foundedObject, criterias[attribut]);
                    }
                }
            }
            return found;
        }
        return collection.filter(megaFilter);
    }

    export function orderCriteria<T>(collection: T[], criteriaOrder: IOrderAscendant[] = []): T[] {
        function megaSorter(item1: T, item2: T): number {
            let resultat = 0;
            let orderAscendant: IOrderAscendant;
            for (let i = 0; i < criteriaOrder.length && resultat === 0; i++) {
                orderAscendant = criteriaOrder[i];
                resultat = compare(item1[orderAscendant.attribute], item2[orderAscendant.attribute], orderAscendant.ascendant);
            }
            return resultat;
        }
        return collection.sort(megaSorter);
    }

    export function DragnDrop(id: string | HTMLElement, callback: (text: string, name?: string) => void, scope: any): void {
        let container = typeof id === 'string' ? document.getElementById(id) : id;
        if (container !== null) {

            function handleDragOver(evt: DragEvent): void {
                evt.stopPropagation();
                evt.preventDefault();
                evt.dataTransfer.dropEffect = 'copy';
            }

            function dropFiles(evt: DragEvent): void {
                evt.stopPropagation();
                evt.preventDefault();
                let files = evt.dataTransfer.files;
                for (let i = 0; i < files.length; i++) {
                    let reader = new FileReader();
                    reader.onload = () => {
                        callback.call(scope, reader.result, files[i].name);
                    };
                    reader.readAsText(files[i]);
                }
            }

            container.addEventListener('dragover', handleDragOver, false);
            container.addEventListener('drop', dropFiles, false);
        } else {
            throw new Error('not an HTML Element');
        }
    }

    export function extrapolator<U>(
        normalizedBase: U[], xProperty: string, yProperty: string, strongLimit: boolean = false): (x: number) => number {
        let length = normalizedBase.length;
        let resultat = (x: number) => 0;
        if (length > 0) {
            resultat = (x: number) => {
                let indMin = 0;
                let indMax = length - 1;
                let index = Math.floor(length / 2);
                let found = false;
                let out = 0;
                if (x < normalizedBase[0][xProperty]) {
                    index = strongLimit === true ? -1 : 0;
                    found = true;
                }
                if (x > normalizedBase[length - 1][xProperty]) {
                    index = indMax;
                    indMin = indMax - 1;
                    found = false;
                    if (strongLimit === true) {
                        found = true;
                        index = -1;
                    }
                }
                while ((indMax !== indMin + 1) && !found) {
                    if (normalizedBase[index][xProperty] === x) {
                        indMin = index;
                        indMax = index;
                        found = true;
                    } else {
                        if (normalizedBase[index][xProperty] < x) {
                            indMin = index;
                        } else {
                            if (normalizedBase[index][xProperty] > x) {
                                indMax = index;
                            }
                        }
                    }
                    index = Math.floor((indMin + indMax) / 2);
                }
                if (found) {
                    out = index < 0 ? 0 : normalizedBase[index][yProperty];
                } else {
                    // calcul du ratio
                    out = (normalizedBase[indMax][yProperty] - normalizedBase[indMin][yProperty]) *
                        (x - normalizedBase[indMin][xProperty]) /
                        (normalizedBase[indMax][xProperty] - normalizedBase[indMin][xProperty]) + normalizedBase[indMin][yProperty];
                }
                return out;
            };
        }
        return resultat;
    }

    /* tslint:disable */
    let iso8601RegExp = /(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))/;
    /* tslint:enable */

    // to use for JSON.parse
    export var reviver: any = <U>(key: string, value: any): U | any => {
        let resultat: any | U = value;

        if (value !== null && typeof value === 'object' &&
            typeof value.ctor === 'string' &&
            typeof value.data !== 'undefined') {
            let ctor = reviver.constructors[value.ctor];
            if (typeof ctor === 'function' &&
                typeof ctor.fromJSON === 'function') {
                resultat = <U>ctor.fromJSON(value);
            } else if (typeof value === 'string') {
                let temp = value.replace(' ', '');
                if (iso8601RegExp.exec(temp)) {
                    value = new Date(temp);
                }
            }
        }
        return resultat;
    };

    export function Generic_toJSON(ctorName: string, obj: any, keys?: string[]): { ctor: string, data: any } {
        let data, index, key;

        if (keys === undefined) {
            keys = Object.keys(obj);
        }

        data = {};
        for (index = 0; index < keys.length; ++index) {
            key = keys[index];
            data[key] = obj[key];
        }
        return { ctor: ctorName, data: data };
    }

    export function Generic_fromJSON<U>(ctor: any, data: any): U {
        let obj: U, name: string;

        obj = new ctor();
        for (name in data) {
            if (data.hasOwnProperty(name)) {
                obj[name] = data[name];
            }
        }
        return obj;
    }

    reviver.constructors = {};
    reviver.constructors.Cartographic = Cartographic;
    reviver.constructors.Coordinate = Coordinate;
    reviver.constructors.NEDLocal = NEDLocal;

}
