'use strict';
import { CONFIGURATION } from './configuration';
import { NEDLocal, Coordinate } from './referential';
import {
	ICartographic,
	ISumUpCriteria,
	IItemCriteria,
	ICriterias,
	IOrderAscendant,
	IBBox,
	IListFile,
} from '../definitions/project';

export class Cartographic implements ICartographic {
	public latitude: number;
	public longitude: number;
	public height: number;

	public static approximateDistance(pos1: Cartographic, pos2: Cartographic): number {
		const x = (pos1.longitude - pos2.longitude) * Math.cos((pos1.latitude + pos2.latitude) / 2);
		const y = pos1.latitude - pos2.latitude;
		return Math.sqrt(x * x + y * y);
	}

	public static exactDistance(pos1: Cartographic, pos2: Cartographic): number {
		let resultat = Math.sin(pos1.latitude) * Math.sin(pos2.latitude);
		resultat += Math.cos(pos1.latitude) * Math.cos(pos2.latitude) * Math.cos(pos2.longitude - pos1.longitude);
		return Math.acos(resultat);
	}

	public static isInside(position: Cartographic, boundary: Cartographic[]): boolean {
		let cn = 0; // The  crossing number counter
		let iplus: number;
		const n = boundary.length;
		// Loop through all edges of the polygon
		for (let i = 0; i < n; i++) {
			// Edge from V[i]  to V[i+1]
			iplus = i === n - 1 ? 0 : i + 1;
			if (
				(boundary[i].latitude <= position.latitude && boundary[iplus].latitude > position.latitude) ||
				(boundary[i].latitude > position.latitude && boundary[iplus].latitude <= position.latitude)
			) {
				const vt =
					(position.latitude - boundary[i].latitude) / (boundary[iplus].latitude - boundary[i].latitude);
				if (
					position.longitude <
					boundary[i].longitude + vt * (boundary[iplus].longitude - boundary[i].longitude)
				) {
					cn++;
				}
			}
		}

		return cn % 2 === 1; // 0 if even (out), and 1 if  odd (in)
	}

	public static lerp(pos1: Cartographic, pos2: Cartographic, fractions: number[] = []): Cartographic[] {
		const distance = Cartographic.exactDistance(pos1, pos2);
		const resultat: Cartographic[] = [];
		if (distance > 0) {
			fractions.forEach(fraction => {
				const A = Math.sin((1 - fraction) * distance) / Math.sin(distance);
				const B = Math.sin(fraction * distance) / Math.sin(distance);
				const x =
					A * Math.cos(pos1.latitude) * Math.cos(pos1.longitude) +
					B * Math.cos(pos2.latitude) * Math.cos(pos2.longitude);
				const y =
					A * Math.cos(pos1.latitude) * Math.sin(pos1.longitude) +
					B * Math.cos(pos2.latitude) * Math.sin(pos2.longitude);
				const z = A * Math.sin(pos1.latitude) + B * Math.sin(pos2.latitude);
				resultat.push(
					new Cartographic(
						Math.atan2(z, Math.sqrt(x * x + y * y)),
						Math.atan2(y, x),
						(1 - fraction) * pos1.height + fraction * pos2.height
					)
				);
			});
		}

		return resultat;
	}

	public static direction(pos1: Cartographic, pos2: Cartographic): number {
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

	public clone(): Cartographic {
		return new Cartographic(this.longitude, this.latitude, this.height);
	}

	public approximateDistance(pos2: Cartographic): number {
		return Cartographic.approximateDistance(this, pos2);
	}

	public exactDistance(pos2: Cartographic): number {
		return Cartographic.exactDistance(this, pos2);
	}

	public lerp(pos2: Cartographic, fractions: number[] = []): Cartographic[] {
		return Cartographic.lerp(this, pos2, fractions);
	}

	public direction(pos: Cartographic): number {
		return Cartographic.direction(this, pos);
	}

	public toThreeGLSL(): number[] {
		return [this.longitude, this.latitude, this.height];
	}
}

export const ZERO_CARTOGRAPHIC = new Cartographic();

Object.freeze(ZERO_CARTOGRAPHIC);

function updateSumupCriteriaByDateOrNumber(subObject: { max: Date | number; min: Date | number }, temporary): void {
	const comparMin = compare(subObject.min, temporary, true);
	const comparMax = compare(subObject.max, temporary, true);
	if (comparMin > 0) {
		subObject.min = temporary;
	}

	if (comparMax < 0) {
		subObject.max = temporary;
	}
}

export function updateSumUpCriteria(sumup: ISumUpCriteria, properties: any): ISumUpCriteria {
	let temporary;
	let typeofTemporary;
	// Attention si properties est un tableau
	for (const attribute in properties) {
		if (properties.hasOwnProperty(attribute)) {
			temporary = properties[attribute];
			if (temporary !== undefined || temporary !== null) {
				typeofTemporary = typeof temporary;
				if (sumup.hasOwnProperty(attribute)) {
					switch (typeofTemporary) {
						case 'string':
							if (sumup[attribute].type === 'string') {
								if (!(<string[]>sumup[attribute].sumUp).includes(temporary)) {
									(<string[]>sumup[attribute].sumUp).push(temporary);
								}
							} else {
								sumup[attribute].type = 'undefined';
								delete sumup[attribute].sumUp;
							}

							break;
						case 'object':
							if (temporary instanceof Date && sumup[attribute].type === 'date') {
								updateSumupCriteriaByDateOrNumber(
									<{ max: Date; min: Date }>sumup[attribute].sumUp,
									temporary
								);
							} else if (Array.isArray(temporary) && sumup[attribute].type === 'array') {
								temporary.forEach(item => {
									updateSumUpCriteria(<ISumUpCriteria>sumup[attribute].sumUp, item);
								});
							} else if (sumup[attribute].type === 'object') {
								updateSumUpCriteria(<ISumUpCriteria>sumup[attribute].sumUp, temporary);
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
								updateSumupCriteriaByDateOrNumber(
									<{ max: number; min: number }>sumup[attribute].sumUp,
									temporary
								);
							} else {
								sumup[attribute].type = 'undefined';
								delete sumup[attribute].sumUp;
							}

							break;
						default:
					}
				} else {
					switch (typeofTemporary) {
						case 'string':
							sumup[attribute] = { type: 'string', sumUp: [] };
							(<string[]>sumup[attribute].sumUp).push(temporary);
							break;
						case 'object':
							if (temporary instanceof Date) {
								sumup[attribute] = { type: 'date', sumUp: { max: temporary, min: temporary } };
							} else if (Array.isArray(temporary)) {
								sumup[attribute] = { type: 'array', sumUp: {} };
								temporary.forEach(item => {
									updateSumUpCriteria(<ISumUpCriteria>sumup[attribute].sumUp, item);
								});
							} else {
								sumup[attribute] = { type: 'object', sumUp: {} };
								updateSumUpCriteria(<ISumUpCriteria>sumup[attribute].sumUp, temporary);
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
							sumup[attribute] = { type: 'number', sumUp: { max: temporary, min: temporary } };
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

	const ob1Float = Number.parseFloat(ob1);
	const ob2Float = Number.parseFloat(ob2);
	if (ob1 instanceof Date && ob2 instanceof Date) {
		resultat = ob1.getTime() - ob2.getTime();
	} else if (
		!Number.isNaN(ob1Float) &&
		!Number.isNaN(ob2Float) &&
		ob1.length === ob1Float.toString().length &&
		ob2.length === ob2Float.toString().length
	) {
		resultat = ob1Float - ob2Float;
	} else {
		const ob1String = ob1.toString().toLowerCase();
		const ob2String = ob2.toString().toLowerCase();
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
		value.forEach(item => {
			resultat = resultat || compareItemCriteria(item, itemCriteria);
		});
	} else {
		const comparison = compare(value, itemCriteria.value, true);
		const comparator = itemCriteria.comparator;
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
		} else if (comparison === 0) {
			resultat = true;
		}
	}

	return resultat;
}

function getObjectByString(objet: any, path: string): any {
	path = path.replace(/\[(\w+|\*)]/g, '.$1'); // Convert indexes to properties
	path = path.replace(/^\./, ''); // Strip a leading dot
	const tab = path.split('.');
	let subAttribut = tab.shift();
	let finished = false;
	while (subAttribut !== undefined && !finished && objet !== undefined) {
		if (subAttribut === '') {
			// Nothing
		} else if (subAttribut === '*') {
			const subPath = tab.join('.');
			if (Array.isArray(objet)) {
				objet = objet.map(item => getObjectByString(item, subPath));
				finished = true;
			} else if (typeof objet === 'object' && !(objet instanceof Date)) {
				objet = Object.getOwnPropertyNames(objet).map(attributName =>
					getObjectByString(objet[attributName], subPath)
				);
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

export function searchCriterias<T>(
	collection: T[],
	criterias: ICriterias,
	forbiddenAttributes: string[] = [],
	child?: string
): T[] {
	const criteriasKey = Object.keys(criterias);
	const regex = new RegExp('(' + forbiddenAttributes.join('|') + ')', 'g');
	function megaFilter(item: T): boolean {
		let found = true;
		let foundedObject: any;
		const out: any = child === undefined ? item : getObjectByString(item, child);
		let attribut: string;
		for (let i = 0; i < criteriasKey.length && found; i++) {
			attribut = criteriasKey[i];
			if (regex.exec(attribut) === null) {
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

	return collection.filter(x => megaFilter(x));
}

export function orderCriteria<T>(collection: T[], criteriaOrder: IOrderAscendant[] = []): T[] {
	function megaSorter(item1: T, item2: T): number {
		let resultat = 0;
		let orderAscendant: IOrderAscendant;
		for (let i = 0; i < criteriaOrder.length && resultat === 0; i++) {
			orderAscendant = criteriaOrder[i];
			resultat = compare(
				item1[orderAscendant.attribute],
				item2[orderAscendant.attribute],
				orderAscendant.ascendant
			);
		}

		return resultat;
	}

	return collection.sort(megaSorter);
}

export function DragnDrop(id: string | HTMLElement, callback: (list: IListFile[]) => void, scope: any): void {
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
				Array.from(files, async file => {
					return new Promise(resolve => {
						const reader = new FileReader();
						reader.addEventListener('load', () => {
							resolve({ name: file.name, text: reader.result });
						});

						reader.readAsText(file);
					});
				})
			).then(tab => callback.call(scope, tab));
		}

		container.addEventListener('dragover', handleDragOver, false);
		container.addEventListener('drop', dropFiles, false);
	}
}

/**
 * Fonction permettant d'interpoler des valeurs numériques depuis un tableau
 * @param  normalizedBase tableau d'objets contenant un attribut numérique en
 * abscisses et un attribut numérique en ordonnées. Le tableau doit être
 * ordonnée selon l'attribut des abscisses
 * @param  xProperty nom de l'attribut correspondant aux abscisses.
 * @param  yProperty nom de l'attribut correspondant aux ordonnées.
 * @param  strongLimit indique si la fonction retournée extrapole hors des
 * limites du tablea fourni en paramètre..
 * @return  une fonction interpolant
 */
export function interpolator<U>(
	normalizedBase: U[],
	xProperty: string,
	yProperty: string,
	strongLimit = false
): (x: number) => number {
	const length = normalizedBase.length;
	let resultat: (x?: number) => number = () => 0;
	if (length === 1) {
		resultat = () => normalizedBase[0][yProperty];
	} else {
		resultat = (x: number) => {
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
				// Calcul du ratio
				out =
					((normalizedBase[indMax][yProperty] - normalizedBase[indMin][yProperty]) *
						(x - normalizedBase[indMin][xProperty])) /
						(normalizedBase[indMax][xProperty] - normalizedBase[indMin][xProperty]) +
					normalizedBase[indMin][yProperty];
			}

			return out;
		};
	}

	return resultat;
}

const iso8601RegExp = /(\d{4}-[01]\d-[0-3]\dT[0-2](?:\d:[0-5]){2}\d\.\d+([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2](?:\d:[0-5]){2}\d([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))/;

// To use for JSON.parse
export const reviver: any = <U>(_key: string, value: any): U | any => {
	const resultat: any | U = value;

	if (typeof value === 'string') {
		const temporary = value.replace(' ', '');
		if (iso8601RegExp.exec(temporary)) {
			value = new Date(temporary);
		}
	}

	return resultat;
};

export function matchingBBox(pos: Cartographic, bboxes: IBBox[]): Cartographic[][] {
	return bboxes
		.filter(
			bboxe =>
				pos.latitude >= bboxe.minLat &&
				pos.latitude <= bboxe.maxLat &&
				pos.longitude >= bboxe.minLong &&
				pos.longitude <= bboxe.maxLong &&
				Cartographic.isInside(pos, bboxe.boundary)
		)
		.map(bboxe => bboxe.boundary);
}

export function getLocalLimits(
	boundaries: Cartographic[][],
	referential: NEDLocal
): Array<{ clock: number; distance: number }> {
	const allPoints: Coordinate[] = [];
	boundaries.forEach(boundary => {
		boundary.forEach(position => {
			allPoints.push(referential.cartographic2NED(position));
		});
	});
	const clockDistance = allPoints
		.map(pos => {
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
	const resultat: Array<{ clock: number; distance: number }> = [];
	for (const clockString in clockDistance) {
		if (clockDistance.hasOwnProperty(clockString)) {
			resultat.push({ clock: Number.parseFloat(clockString), distance: clockDistance[clockString] });
		}
	}

	const length = resultat.length;
	let temporary;
	for (let i = 0; i < length; i++) {
		temporary = resultat[i];
		resultat.push(
			{ clock: temporary.clock - CONFIGURATION.TWO_PI, distance: temporary.distance },
			{ clock: temporary.clock + CONFIGURATION.TWO_PI, distance: temporary.distance }
		);
	}

	return resultat.sort((a, b) => a.clock - b.clock);
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

const link = document.createElement('a');
/**
 * Export in Wavefront OBJ format.
 * Exported file can be imported in Blender.
 *
 * Three files a generated:
 * * sceneCones.obj
 * * sceneCurvesLongHaul.obj fo short distance flights above the geodesic
 * * sceneCurvesShortHaul.obj for long distance geodesic flights
 *
 * @param blob     data table in blob format
 * @param filename filename of data table (location to user choice)
 *
 */
export function save(blob: any, filename: string): void {
	link.href = URL.createObjectURL(blob);
	link.download = filename;
	link.click();
}
