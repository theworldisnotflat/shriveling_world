'use strict';
import { Cartographic, ZERO_CARTOGRAPHIC } from './utils';
import { CONFIGURATION } from './configuration';
import { INEDLocalGLSL } from '../definitions/project';
function Cartographic2ECEF(pos: Cartographic): Coordinate {
	const radius = CONFIGURATION.earthRadiusMeters + pos.height;
	return new Coordinate(
		Math.cos(pos.longitude) * radius * Math.cos(pos.latitude),
		Math.sin(pos.longitude) * radius * Math.cos(pos.latitude),
		Math.sin(pos.latitude) * radius
	);
}

function ECEF2Cartographic(pos: Coordinate): Cartographic {
	const out = new Cartographic();
	const radius = Math.sqrt(pos.x * pos.x + pos.y * pos.y + pos.z * pos.z);
	out.height = radius - CONFIGURATION.earthRadiusMeters;
	if (radius > 0) {
		out.longitude = Math.atan2(pos.y, pos.x);
		const sin = Math.sin(out.longitude);
		if (Math.abs(sin) > 1e-20) {
			out.latitude = Math.atan2(pos.z, pos.y / sin);
		} else {
			const cos = Math.cos(out.longitude);
			out.latitude = Math.atan2(pos.z, pos.x / cos);
		}
	}

	return out;
}

export class Coordinate {
	public x: number;
	public y: number;
	public z: number;

	public static dot(vec1: Coordinate, vec2: Coordinate): number {
		return vec1.x * vec2.x + vec1.y * vec2.y + vec1.z * vec2.z;
	}

	public static multiplyVector(vec1: Coordinate, vec2: Coordinate, result?: Coordinate): Coordinate {
		result = result instanceof Coordinate ? result : new Coordinate();
		result.x = vec1.y * vec2.z - vec1.z * vec2.y;
		result.y = vec1.z * vec2.x - vec1.x * vec2.z;
		result.z = vec1.x * vec2.y - vec1.y * vec2.x;
		return result;
	}

	public static scalar(vec1: Coordinate, coef: number, result?: Coordinate): Coordinate {
		result = result instanceof Coordinate ? result : new Coordinate();
		result.x = vec1.x * coef;
		result.y = vec1.y * coef;
		result.z = vec1.z * coef;
		return result;
	}

	public static add(vec1: Coordinate, vec2: Coordinate, result?: Coordinate): Coordinate {
		result = result instanceof Coordinate ? result : new Coordinate();
		result.x = vec1.x + vec2.x;
		result.y = vec1.y + vec2.y;
		result.z = vec1.z + vec2.z;
		return result;
	}

	public static distance(vec1: Coordinate, vec2: Coordinate): number {
		return Math.sqrt(
			(vec1.x - vec2.x) * (vec1.x - vec2.x) +
				(vec1.y - vec2.y) * (vec1.y - vec2.y) +
				(vec1.z - vec2.z) * (vec1.z - vec2.z)
		);
	}

	public constructor(x = 0, y = 0, z = 0) {
		this.x = x;
		this.y = y;
		this.z = z;
	}

	public normalize(): Coordinate {
		const distance = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
		if (distance > 1e-13) {
			this.x /= distance;
			this.y /= distance;
			this.z /= distance;
		}

		return this;
	}

	public dot(vec2: Coordinate): number {
		return Coordinate.dot(this, vec2);
	}

	public multiplyVector(vec2: Coordinate, result?: Coordinate): Coordinate {
		return Coordinate.multiplyVector(this, vec2, result);
	}

	public scalar(coef: number, result?: Coordinate): Coordinate {
		return Coordinate.scalar(this, coef, result);
	}

	public add(vec2: Coordinate, result?: Coordinate): Coordinate {
		return Coordinate.add(this, vec2, result);
	}

	public distance(vec2: Coordinate): number {
		return Coordinate.distance(this, vec2);
	}
}

const scrapCoordinate = new Coordinate();
const scrapCoordinate2 = new Coordinate();

/**
 * General model for the orientation of geometric elements
 *
 * As cones are drawn below the earth surface, we chose the North East Down orientation
 * that is the most adapted to our model.
 *
 * North East Down generates 'navigation' like orientations for angles on the sphere
 * and on a projected plane
 */
export class NEDLocal {
	public cartoRef: Cartographic;
	private readonly _ECEFRef: Coordinate;
	private readonly _matECEF2NED: Coordinate[];
	private readonly _matNED2ECEF: Coordinate[];
	private _glslData: INEDLocalGLSL;

	public constructor(summit: Cartographic = ZERO_CARTOGRAPHIC) {
		const sinLong = Math.sin(summit.longitude);
		const cosLong = Math.cos(summit.longitude);
		const sinLat = Math.sin(summit.latitude);
		const cosLat = Math.cos(summit.latitude);
		this.cartoRef = summit;
		this._ECEFRef = Cartographic2ECEF(summit);

		this._matECEF2NED = [];
		this._matECEF2NED.push(new Coordinate(-cosLong * sinLat, -sinLong * sinLat, cosLat)); // North
		this._matECEF2NED.push(new Coordinate(-sinLong, cosLong, 0)); // East
		this._matECEF2NED.push(new Coordinate(-cosLong * cosLat, -sinLong * cosLat, -sinLat)); // Down

		this._matNED2ECEF = []; // Transposate
		this._matNED2ECEF.push(new Coordinate(-cosLong * sinLat, -sinLong, -cosLong * cosLat));
		this._matNED2ECEF.push(new Coordinate(-sinLong * sinLat, cosLong, -sinLong * cosLat));
		this._matNED2ECEF.push(new Coordinate(cosLat, 0, -sinLat));
	}

	public cartographic2NED(pos: Cartographic): Coordinate {
		const ecefPos = Cartographic2ECEF(pos);
		const relativeECEF = ecefPos.add(this._ECEFRef.scalar(-1, scrapCoordinate), scrapCoordinate);
		return new Coordinate(
			this._matECEF2NED[0].dot(relativeECEF),
			this._matECEF2NED[1].dot(relativeECEF),
			this._matECEF2NED[2].dot(relativeECEF)
		);
	}

	public NED2Cartographic(pos: Coordinate): Cartographic {
		const relativeECEF = new Coordinate(
			this._matNED2ECEF[0].dot(pos),
			this._matNED2ECEF[1].dot(pos),
			this._matNED2ECEF[2].dot(pos)
		);
		const ecefPos = relativeECEF.add(this._ECEFRef, scrapCoordinate);
		return ECEF2Cartographic(ecefPos);
	}

	public getClock(pos: Cartographic): number {
		const temp = this.cartographic2NED(pos);
		const clock = Math.atan2(temp.y, temp.x);
		return clock < 0 ? clock + Math.PI * 2 : clock;
	}

	public direction2Position(clock: number, alpha: number, result?: Coordinate): Coordinate {
		result = result instanceof Coordinate ? result : new Coordinate();
		const cosEl = Math.cos(alpha);
		const sinEl = Math.sin(alpha);
		const cosClock = Math.cos(clock);
		const sinClock = Math.sin(clock);
		result.x = cosEl * cosClock; // Cos alpha * cos clock
		result.y = cosEl * sinClock; // Cos alpha * sin clock
		result.z = sinEl; // Sin alpha
		return result;
	}

	public project(clock: number, alpha: number, distance: number): Cartographic {
		this.direction2Position(clock, alpha, scrapCoordinate2).scalar(distance, scrapCoordinate2);
		return this.NED2Cartographic(scrapCoordinate2);
	}

	get ned2ECEFMatrix(): INEDLocalGLSL {
		if (this._glslData === undefined) {
			const mat = this._matECEF2NED;
			const summit = this.cartoRef.toThreeGLSL();
			this._glslData = {
				ned2ECEF0: [mat[0].x, mat[0].y, mat[0].z],
				ned2ECEF1: [mat[1].x, mat[1].y, mat[1].z],
				ned2ECEF2: [mat[2].x, mat[2].y, mat[2].z],
				summit,
			};
		}

		return this._glslData;
	}
}
