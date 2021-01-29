'use strict';
import { CONFIGURATION } from './configuration';
import type { NEDLocal, Coordinate } from './referential';
import type {
	ILatLonH,
	ISumUpCriteria,
	IItemCriteria,
	ICriteria,
	IOrderAscendant,
	IBBox,
	IListFile,
} from '../definitions/project';

export class LatLonH implements ILatLonH {
	public latitude: number;
	public longitude: number;
	public height: number;

	public static approximateDistance(pos1: LatLonH, pos2: LatLonH): number {
		const x = (pos1.longitude - pos2.longitude) * Math.cos((pos1.latitude + pos2.latitude) / 2);
		const y = pos1.latitude - pos2.latitude;
		return Math.sqrt(x * x + y * y);
	}

	public static exactDistance(pos1: LatLonH, pos2: LatLonH): number {
		let result = Math.sin(pos1.latitude) * Math.sin(pos2.latitude);
		result += Math.cos(pos1.latitude) * Math.cos(pos2.latitude) * Math.cos(pos2.longitude - pos1.longitude);
		return Math.acos(result);
	}

	public static isInside(position: LatLonH, boundary: LatLonH[]): boolean {
		let cn = 0; // The  crossing number counter
		let iPlus: number;
		const n = boundary.length;
		// Loop through all edges of the polygon
		for (let i = 0; i < n; i++) {
			// Edge from V[i]  to V[i+1]
			iPlus = i === n - 1 ? 0 : i + 1;
			if (
				(boundary[i].latitude <= position.latitude && boundary[iPlus].latitude > position.latitude) ||
				(boundary[i].latitude > position.latitude && boundary[iPlus].latitude <= position.latitude)
			) {
				const vt =
					(position.latitude - boundary[i].latitude) / (boundary[iPlus].latitude - boundary[i].latitude);
				if (
					position.longitude <
					boundary[i].longitude + vt * (boundary[iPlus].longitude - boundary[i].longitude)
				) {
					cn++;
				}
			}
		}

		return cn % 2 === 1; // 0 if even (out), and 1 if  odd (in)
	}

	public static lerp(pos1: LatLonH, pos2: LatLonH, fractions: number[] = []): LatLonH[] {
		const distance = LatLonH.exactDistance(pos1, pos2);
		const result: LatLonH[] = [];
		if (distance > 0) {
			fractions.forEach((fraction) => {
				const A = Math.sin((1 - fraction) * distance) / Math.sin(distance);
				const B = Math.sin(fraction * distance) / Math.sin(distance);
				const x =
					A * Math.cos(pos1.latitude) * Math.cos(pos1.longitude) +
					B * Math.cos(pos2.latitude) * Math.cos(pos2.longitude);
				const y =
					A * Math.cos(pos1.latitude) * Math.sin(pos1.longitude) +
					B * Math.cos(pos2.latitude) * Math.sin(pos2.longitude);
				const z = A * Math.sin(pos1.latitude) + B * Math.sin(pos2.latitude);
				result.push(
					new LatLonH(
						Math.atan2(z, Math.sqrt(x * x + y * y)),
						Math.atan2(y, x),
						(1 - fraction) * pos1.height + fraction * pos2.height
					)
				);
			});
		}

		return result;
	}

	public static direction(pos1: LatLonH, pos2: LatLonH): number {
		return Math.atan2(pos2.latitude - pos1.latitude, pos2.longitude - pos1.longitude);
	}

	constructor(longitude = 0, latitude = 0, height = 0, isRadians = true) {
		if (!isRadians) {
			latitude *= CONFIGURATION.deg2rad;
			longitude *= CONFIGURATION.deg2rad;
		}

		this.latitude = latitude;
		this.longitude = longitude;
		this.height = height;
	}

	public clone(): LatLonH {
		return new LatLonH(this.longitude, this.latitude, this.height);
	}

	public approximateDistance(pos2: LatLonH): number {
		return LatLonH.approximateDistance(this, pos2);
	}

	public exactDistance(pos2: LatLonH): number {
		return LatLonH.exactDistance(this, pos2);
	}

	public lerp(pos2: LatLonH, fractions: number[] = []): LatLonH[] {
		return LatLonH.lerp(this, pos2, fractions);
	}

	public direction(pos: LatLonH): number {
		return LatLonH.direction(this, pos);
	}

	public toThreeGLSL(): number[] {
		return [this.longitude, this.latitude, this.height];
	}
}

export const ZERO_LATLONH = new LatLonH();

Object.freeze(ZERO_LATLONH);

function updateSumUpCriteriaByDateOrNumber(subObject: { max: Date | number; min: Date | number }, temporary): void {
	const comparMin = compare(subObject.min, temporary, true);
	const comparMax = compare(subObject.max, temporary, true);
	if (comparMin > 0) {
		subObject.min = temporary;
	}

	if (comparMax < 0) {
		subObject.max = temporary;
	}
}

export function updateSumUpCriteria(sumUp: ISumUpCriteria, properties: Record<string, unknown>): ISumUpCriteria {
	let temporary;
	let typeofTemporary;
	// Attention si properties est un tableau
	for (const attribute in properties) {
		if (properties.hasOwnProperty(attribute)) {
			temporary = properties[attribute];
			if (temporary !== undefined || temporary !== null) {
				typeofTemporary = typeof temporary;
				if (sumUp.hasOwnProperty(attribute)) {
					switch (typeofTemporary) {
						case 'string':
							if (sumUp[attribute].type === 'string') {
								if (!(<string[]>sumUp[attribute].sumUp).includes(temporary)) {
									(<string[]>sumUp[attribute].sumUp).push(temporary);
								}
							} else {
								sumUp[attribute].type = 'undefined';
								delete sumUp[attribute].sumUp;
							}

							break;
						case 'object':
							if (temporary instanceof Date && sumUp[attribute].type === 'date') {
								updateSumUpCriteriaByDateOrNumber(
									<{ max: Date; min: Date }>sumUp[attribute].sumUp,
									temporary
								);
							} else if (Array.isArray(temporary) && sumUp[attribute].type === 'array') {
								temporary.forEach((item) => {
									updateSumUpCriteria(<ISumUpCriteria>sumUp[attribute].sumUp, item);
								});
							} else if (sumUp[attribute].type === 'object') {
								updateSumUpCriteria(<ISumUpCriteria>sumUp[attribute].sumUp, temporary);
							} else {
								sumUp[attribute].type = 'undefined';
								delete sumUp[attribute].sumUp;
							}

							break;
						case 'boolean':
							if (sumUp[attribute].type !== 'boolean') {
								sumUp[attribute].type = 'undefined';
								delete sumUp[attribute].sumUp;
							}

							break;
						case 'symbol':
							break;
						case 'function':
							break;
						case 'number':
							if (sumUp[attribute].type === 'number') {
								updateSumUpCriteriaByDateOrNumber(
									<{ max: number; min: number }>sumUp[attribute].sumUp,
									temporary
								);
							} else {
								sumUp[attribute].type = 'undefined';
								delete sumUp[attribute].sumUp;
							}

							break;
						default:
					}
				} else {
					switch (typeofTemporary) {
						case 'string':
							sumUp[attribute] = { type: 'string', sumUp: [] };
							(<string[]>sumUp[attribute].sumUp).push(temporary);
							break;
						case 'object':
							if (temporary instanceof Date) {
								sumUp[attribute] = { type: 'date', sumUp: { max: temporary, min: temporary } };
							} else if (Array.isArray(temporary)) {
								sumUp[attribute] = { type: 'array', sumUp: {} };
								temporary.forEach((item) => {
									updateSumUpCriteria(<ISumUpCriteria>sumUp[attribute].sumUp, item);
								});
							} else {
								sumUp[attribute] = { type: 'object', sumUp: {} };
								updateSumUpCriteria(<ISumUpCriteria>sumUp[attribute].sumUp, temporary);
							}

							break;
						case 'boolean':
							sumUp[attribute] = { type: 'boolean' };
							break;
						case 'symbol':
							break;
						case 'function':
							break;
						case 'number':
							sumUp[attribute] = { type: 'number', sumUp: { max: temporary, min: temporary } };
							break;
						default:
					}
				}
			}
		}
	}

	return sumUp;
}

function compare(ob1: any, ob2: any, ascendant: boolean): number {
	let result = 0;
	if (ob1 === undefined || ob1 === null) {
		ob1 = '';
	}

	if (ob2 === undefined || ob2 === null) {
		ob2 = '';
	}

	const ob1Float = Number.parseFloat(ob1);
	const ob2Float = Number.parseFloat(ob2);
	if (ob1 instanceof Date && ob2 instanceof Date) {
		result = ob1.getTime() - ob2.getTime();
	} else if (
		!Number.isNaN(ob1Float) &&
		!Number.isNaN(ob2Float) &&
		ob1.length === ob1Float.toString().length &&
		ob2.length === ob2Float.toString().length
	) {
		result = ob1Float - ob2Float;
	} else {
		const ob1String = ob1.toString().toLowerCase();
		const ob2String = ob2.toString().toLowerCase();
		if (ob1String === ob2String) {
			result = 0;
		} else if (ob1String > ob2String) {
			result = 1;
		} else {
			result = -1;
		}
	}

	if (!ascendant) {
		result = -result;
	}

	return result;
}

function compareItemCriteria(value: any, itemCriteria: IItemCriteria): boolean {
	let result = false;
	if (Array.isArray(value)) {
		value.forEach((item) => {
			result = result || compareItemCriteria(item, itemCriteria);
		});
	} else {
		const comparison = compare(value, itemCriteria.value, true);
		const comparator = itemCriteria.comparator;
		if (comparator === '>') {
			if (comparison > 0) {
				result = true;
			}
		} else if (comparator === '>=') {
			if (comparison >= 0) {
				result = true;
			}
		} else if (comparator === '<') {
			if (comparison < 0) {
				result = true;
			}
		} else if (comparator === '<=') {
			if (comparison <= 0) {
				result = true;
			}
		} else if (comparator === '!=') {
			if (comparison !== 0) {
				result = true;
			}
		} else if (comparison === 0) {
			result = true;
		}
	}

	return result;
}

function getObjectByString(objet: any, path: string): any {
	path = path.replace(/\[(\w+|\*)]/g, '.$1'); // Convert indexes to properties
	path = path.replace(/^\./, ''); // Strip a leading dot
	const tab = path.split('.');
	let subAttribute = tab.shift();
	let finished = false;
	while (subAttribute !== undefined && !finished && objet !== undefined) {
		if (subAttribute === '') {
			// Nothing
		} else if (subAttribute === '*') {
			const subPath = tab.join('.');
			if (Array.isArray(objet)) {
				objet = objet.map((item) => getObjectByString(item, subPath));
				finished = true;
			} else if (typeof objet === 'object' && !(objet instanceof Date)) {
				objet = Object.getOwnPropertyNames(objet).map((attributeName) =>
					getObjectByString(objet[attributeName], subPath)
				);
				finished = true;
			}
		} else if (subAttribute in objet) {
			objet = objet[subAttribute];
		} else {
			objet = undefined;
		}

		subAttribute = tab.shift();
	}

	return objet;
}

export function searchCriteria<T>(
	collection: T[],
	criteria: ICriteria,
	forbiddenAttributes: string[] = [],
	child?: string
): T[] {
	const criteriaKey = Object.keys(criteria);
	const regex = new RegExp('(' + forbiddenAttributes.join('|') + ')', 'g');
	function megaFilter(item: T): boolean {
		let found = true;
		let foundedObject: any;
		const out: any = child === undefined ? item : getObjectByString(item, child);
		let attribute: string;
		for (let i = 0; i < criteriaKey.length && found; i++) {
			attribute = criteriaKey[i];
			if (regex.exec(attribute) === null) {
				foundedObject = getObjectByString(out, attribute);
				if (foundedObject === undefined) {
					found = false;
				} else {
					found = found && compareItemCriteria(foundedObject, criteria[attribute]);
				}
			}
		}

		return found;
	}

	return collection.filter((x) => megaFilter(x));
}

export function orderCriteria<T>(collection: T[], criteriaOrder: IOrderAscendant[] = []): T[] {
	function megaSorter(item1: T, item2: T): number {
		let result = 0;
		let orderAscendant: IOrderAscendant;
		for (let i = 0; i < criteriaOrder.length && result === 0; i++) {
			orderAscendant = criteriaOrder[i];
			result = compare(
				item1[orderAscendant.attribute],
				item2[orderAscendant.attribute],
				orderAscendant.ascendant
			);
		}

		return result;
	}

	return collection.sort(megaSorter);
}

export function DragNDrop(id: string | HTMLElement, callback: (list: IListFile[]) => void, scope: unknown): void {
	const container = typeof id === 'string' ? document.querySelector('#' + id) : id;
	if (container === null) {
		throw new Error('not an HTML Element');
	} else {
		function handleDragOver(evt: DragEvent): void {
			evt.stopPropagation();
			evt.preventDefault();
			evt.dataTransfer.dropEffect = 'copy';
		}

		function dropFiles(evt: DragEvent): void {
			evt.stopPropagation();
			evt.preventDefault();
			const files = evt.dataTransfer.files;
			void Promise.all(
				Array.from(files, async (file) => {
					return new Promise((resolve) => {
						const reader = new FileReader();
						reader.addEventListener('load', () => {
							resolve({ name: file.name, text: reader.result });
						});

						reader.readAsText(file);
					});
				})
			).then((tab) => callback.call(scope, tab));
		}

		container.addEventListener('dragover', handleDragOver, false);
		container.addEventListener('drop', dropFiles, false);
	}
}

/**
 * Function to interpolate numerical values from a given table
 * @param  normalizedBase input table containing a numeric attribute
 * in x and a numeric attribute in y. The table must be ordered
 * according to x
 * @param  xProperty
 * @param  yProperty
 * @param  strongLimit allow to extrapolate values beyond the limits
 * of the input table
 * @return  an interpolated function
 */
export function interpolator<U>(
	normalizedBase: U[],
	xProperty: string,
	yProperty: string,
	strongLimit = false
): (x: number) => number {
	const length = normalizedBase.length;
	let result: (x?: number) => number = () => 0;
	if (length === 0) {
		result = () => null;
	} else if (length === 1) {
		result = () => normalizedBase[0][yProperty];
	} else {
		result = (x: number) => {
			let indMin = 0;
			let indMax = length - 1;
			let index = Math.floor(length / 2);
			let found = false;
			let out = 0;
			if (x < normalizedBase[0][xProperty]) {
				index = strongLimit ? -1 : 0;
				found = true;
			}

			if (x > normalizedBase[length - 1][xProperty]) {
				index = indMax;
				indMin = indMax - 1;
				found = false;
				if (strongLimit) {
					found = true;
					index = -1;
				}
			}

			while (indMax !== indMin + 1 && !found) {
				if (normalizedBase[index][xProperty] === x) {
					indMin = index;
					indMax = index;
					found = true;
				} else if (normalizedBase[index][xProperty] < x) {
					indMin = index;
				} else if (normalizedBase[index][xProperty] > x) {
					indMax = index;
				}

				index = Math.floor((indMin + indMax) / 2);
			}

			if (found) {
				out = index < 0 ? 0 : normalizedBase[index][yProperty];
			} else {
				// computing ratio
				out =
					((normalizedBase[indMax][yProperty] - normalizedBase[indMin][yProperty]) *
						(x - normalizedBase[indMin][xProperty])) /
						(normalizedBase[indMax][xProperty] - normalizedBase[indMin][xProperty]) +
					normalizedBase[indMin][yProperty];
			}

			return out;
		};
	}

	return result;
}

const iso8601RegExp = /(\d{4}-[01]\d-[0-3]\dT[0-2](?:\d:[0-5]){2}\d\.\d+([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2](?:\d:[0-5]){2}\d([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))/;

// To use for JSON.parse
export const reviver: any = <U>(_key: string, value: any): U | any => {
	const result: any | U = value;

	if (typeof value === 'string') {
		const temporary = value.replace(' ', '');
		if (iso8601RegExp.exec(temporary)) {
			value = new Date(temporary);
		}
	}

	return result;
};

export function matchingBBox(pos: LatLonH, bBoxes: IBBox[]): LatLonH[][] {
	return bBoxes
		.filter(
			(bBox) =>
				pos.latitude >= bBox.minLat &&
				pos.latitude <= bBox.maxLat &&
				pos.longitude >= bBox.minLong &&
				pos.longitude <= bBox.maxLong &&
				LatLonH.isInside(pos, bBox.boundary)
		)
		.map((bBox) => bBox.boundary);
}

export function getLocalLimits(
	boundaries: LatLonH[][],
	referential: NEDLocal
): Array<{ clock: number; distance: number }> {
	const allPoints: Coordinate[] = [];
	boundaries.forEach((boundary) => {
		boundary.forEach((position) => {
			allPoints.push(referential.latLonH2NED(position));
		});
	});
	const clockDistance = allPoints
		.map((pos) => {
			return {
				clock: Math.atan2(pos.y, pos.x),
				distance: Math.sqrt(pos.x * pos.x + pos.y * pos.y + pos.z * pos.z),
			};
		})
		.reduce((result, current) => {
			const clockClass = Math.floor(current.clock / CONFIGURATION.coneStep) * CONFIGURATION.coneStep;
			result[clockClass] =
				result[clockClass] === undefined ? current.distance : Math.min(result[clockClass], current.distance);
			return result;
		}, {});
	const result: Array<{ clock: number; distance: number }> = [];
	for (const clockString in clockDistance) {
		if (clockDistance.hasOwnProperty(clockString)) {
			result.push({ clock: Number.parseFloat(clockString), distance: clockDistance[clockString] });
		}
	}

	const length = result.length;
	let temporary;
	for (let i = 0; i < length; i++) {
		temporary = result[i];
		result.push(
			{ clock: temporary.clock - CONFIGURATION.TWO_PI, distance: temporary.distance },
			{ clock: temporary.clock + CONFIGURATION.TWO_PI, distance: temporary.distance }
		);
	}

	return result.sort((a, b) => a.clock - b.clock);
}

const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');
let rnd = 0;
let r: number;

export function generateUUID(): string {
	let uuid = '';
	for (let i = 0; i < 36; i++) {
		if (i === 8 || i === 13 || i === 18 || i === 23) {
			uuid += '-';
		} else if (i === 14) {
			uuid += '4';
		} else {
			if (rnd <= 0x02) {
				rnd = (0x2000000 + Math.random() * 0x1000000) | 0;
			}

			r = rnd & 0xf;
			rnd >>= 4;
			uuid += chars[i === 19 ? (r & 0x3) | 0x8 : r];
		}
	}

	return uuid;
}
