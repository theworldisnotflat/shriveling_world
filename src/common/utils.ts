'use strict';
import { CONFIGURATION } from './configuration';
import { Vector3 } from 'three';
import { NEDLocal, Coordinate } from './referential';
import {
    ICartographic, IConverterLookup, ISumUpCriteria, IItemCriteria, ICriterias, IOrderAscendant, IBBox, IListFile,
} from '../definitions/project';

export class Cartographic implements ICartographic {
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

    public static fromJSON(value: any): any {
        return Generic_fromJSON(Cartographic, value.data);
    }

    constructor(longitude: number = 0, latitude: number = 0, height: number = 0, isRadians: boolean = true) {
        if (!isRadians) {
            latitude *= CONFIGURATION.deg2rad;
            longitude *= CONFIGURATION.deg2rad;
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

    public direction(pos: Cartographic): number {
        return Cartographic.direction(this, pos);
    }

    public toJSON(): { ctor: string, data: any } {
        return Generic_toJSON('Cartographic', this);
    }

    public toThreeGLSL(): number[] {
        return [this.longitude, this.latitude, this.height];
    }
}

export var ZERO_CARTOGRAPHIC = new Cartographic();

Object.freeze(ZERO_CARTOGRAPHIC);

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

export function DragnDrop(id: string | HTMLElement, callback: (list: IListFile[]) => void, scope: any): void {
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
            Promise.all(Array.from(files, file => {
                return new Promise((resolve) => {
                    let reader = new FileReader();
                    reader.onload = () => {
                        resolve({ name: file.name, text: reader.result });
                    };
                    reader.readAsText(file);
                });
            })).then(tab => callback.call(scope, tab));
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

export function matchingBBox(pos: Cartographic, bboxes: IBBox[]): Cartographic[][] {
    return bboxes.filter((bboxe) => pos.latitude >= bboxe.minLat && pos.latitude <= bboxe.maxLat &&
        pos.longitude >= bboxe.minLong && pos.longitude <= bboxe.maxLong && Cartographic.isInside(pos, bboxe.boundary))
        .map((bboxe) => bboxe.boundary);
}

export function getLocalLimits(
    boundaries: Cartographic[][], referential: NEDLocal): { clock: number, distance: number }[] {
    let allPoints: Coordinate[] = [];
    boundaries.forEach((boundary) => {
        boundary.forEach((position) => {
            allPoints.push(referential.cartographic2NED(position));
        });
    });
    let clockDistance = allPoints.map((pos) => {
        return { clock: Math.atan2(pos.y, pos.x), distance: Math.sqrt(pos.x * pos.x + pos.y * pos.y + pos.z * pos.z) };
    }).reduce(
        (result, current) => {
            let clockClass = Math.floor(current.clock / CONFIGURATION.coneStep) * CONFIGURATION.coneStep;
            result[clockClass] = result[clockClass] === undefined ? current.distance : Math.min(result[clockClass], current.distance);
            return result;
        },
        {});
    let resultat: { clock: number, distance: number }[] = [];
    for (let clockString in clockDistance) {
        if (clockDistance.hasOwnProperty(clockString)) {
            resultat.push({ clock: parseFloat(clockString), distance: clockDistance[clockString] });
        }
    }
    let length = resultat.length;
    let temp: { clock: number, distance: number };
    for (let i = 0; i < length; i++) {
        temp = resultat[i];
        resultat.push(
            { clock: temp.clock - CONFIGURATION.TWO_PI, distance: temp.distance },
            { clock: temp.clock + CONFIGURATION.TWO_PI, distance: temp.distance });
    }
    return resultat.sort((a, b) => a.clock - b.clock);
}

const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');
let rnd = 0, r;

export function generateUUID(): string {
    let uuid = '';
    for (let i = 0; i < 36; i++) {
        if (i === 8 || i === 13 || i === 18 || i === 23) {
            uuid += '-';
        } else if (i === 14) {
            uuid += '4';
        } else {
            if (rnd <= 0x02) { rnd = 0x2000000 + (Math.random() * 0x1000000) | 0; }
            r = rnd & 0xf;
            rnd = rnd >> 4;
            uuid += chars[(i === 19) ? (r & 0x3) | 0x8 : r];
        }
    }
    return uuid;
}
