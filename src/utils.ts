/// <reference path="../node_modules/@types/three/index.d.ts"/>
namespace shriveling {
    'use strict';

    export var mapProjectors: IConverterLookup = {
        none:
        {
            converter:
            (pos: Cartographic, threeRadius: number = Cartographic.THREE_EARTH_RADIUS): THREE.Vector3 => {
                let radius = (Configuration.earthRadiusMeters + pos.height) / Configuration.earthRadiusMeters * threeRadius;
                return new THREE.Vector3(
                    -Math.cos(pos.longitude) * radius * Math.cos(pos.latitude),
                    Math.sin(pos.latitude) * radius,
                    Math.sin(pos.longitude) * radius * Math.cos(pos.latitude),
                );
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
        Equirectangular:
        {
            converter:
            (pos: Cartographic, reference = new Cartographic(), threeRadius: number = Cartographic.THREE_EARTH_RADIUS): THREE.Vector3 => {
                return new THREE.Vector3(
                    (pos.longitude - reference.longitude) * Math.cos(reference.latitude) * threeRadius,
                    (pos.latitude - reference.latitude) * threeRadius,
                    (pos.height - reference.height) / Configuration.earthRadiusMeters * threeRadius,
                );
            },
            reverser:
            (pos: THREE.Vector3, reference = new Cartographic(), threeRadius: number = Cartographic.THREE_EARTH_RADIUS): Cartographic => {
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
            converter:
            (pos: Cartographic, lambda0: number = 0, threeRadius: number = Cartographic.THREE_EARTH_RADIUS): THREE.Vector3 => {
                return new THREE.Vector3(
                    (pos.longitude - lambda0) * threeRadius,
                    Math.log(Math.tan(Math.PI / 4 + pos.latitude / 2)) * threeRadius,
                    pos.height / Configuration.earthRadiusMeters * threeRadius,
                );
            },
            reverser:
            (pos: THREE.Vector3, lambda0: number = 0, threeRadius: number = Cartographic.THREE_EARTH_RADIUS): Cartographic => {
                let cleanPos = pos.clone().multiplyScalar(1 / threeRadius);
                let resultat = new Cartographic();
                resultat.longitude = cleanPos.x + lambda0;
                resultat.height = cleanPos.z + Configuration.earthRadiusMeters;
                resultat.latitude = 2 * (Math.atan(Math.exp(cleanPos.y)) - Math.PI / 4);
                return resultat;
            },
        },

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

        public toTHREEVector3(nameProJections: string[] = []): { [name: string]: THREE.Vector3 } {
            if (nameProJections.length === 0) {
                nameProJections = [...Object.keys(mapProjectors)];
            }
            let that = this;
            let resultat: { [name: string]: THREE.Vector3 } = {};
            nameProJections.forEach((name) => {
                if (mapProjectors.hasOwnProperty(name)) {
                    resultat[name] = mapProjectors[name].converter(that);
                }
            });
            return resultat;
        }

        public direction(pos: Cartographic): number {
            return Cartographic.direction(this, pos);
        }
    }

    export interface IConverter {
        converter: (pos: Cartographic) => THREE.Vector3;
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
    }

    export interface ILookupDirection {
        [year: string]: IDirection[];
    }

    export interface ILookupTransport {
        [transport: string]: ILookupDirection;
    }

    export interface ITownTransport {
        countryName: string;
        countryCode: number;
        cityCode: number;
        cityName: string;
        position: Cartographic;
        referential: NEDLocal;
        transports: ILookupTransport;
        layers?: { [transport: string]: ConeMesh };
    }

    export interface IlookupTownTransport {
        [cityCode: string]: ITownTransport;
    }
    export interface ICitySubLayers {
        [cityCode: number]: ConeMesh;
    }
    export interface ITransportLayers {
        [transport: string]: ICitySubLayers;
    }

    export interface ICriterias {
        [attribut: string]: number | string | Date | boolean;
    }

    export function searchCriterias<T>(collection: T[], criterias: ICriterias, forbiddenAttributes: string[] = [], child?: string): T[] {
        let resultat = collection;
        for (let attribut in criterias) {
            if (criterias.hasOwnProperty(attribut) && forbiddenAttributes.indexOf(attribut) === -1) {
                resultat = resultat.filter((object) => {
                    let out: any = child === undefined ? object : object[child];
                    return out[attribut] === criterias[attribut];
                });
            }
        }
        return resultat;
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

}
