/// <reference path="../node_modules/@types/three/index.d.ts"/>
namespace shriveling {
    'use strict';
    export var deg2rad = Math.PI / 180;
    export var rad2deg = 180 / Math.PI;
    export var earthRadiusMeters = 6371e3;

    export var mapProjectors: IConverterLookup = {
        none: (pos: Cartographic, threeRadius: number = Cartographic.THREE_EARTH_RADIUS): THREE.Vector3 => {
            let radius = (earthRadiusMeters + pos.height) / earthRadiusMeters * threeRadius;
            return new THREE.Vector3(
                -Math.cos(pos.longitude) * radius * Math.cos(pos.latitude),
                Math.sin(pos.latitude) * radius,
                Math.sin(pos.longitude) * radius * Math.cos(pos.latitude)
            );
        },
        Equirectangular: (
            pos: Cartographic, reference = new Cartographic(), threeRadius: number = Cartographic.THREE_EARTH_RADIUS): THREE.Vector3 => {
            return new THREE.Vector3(
                (pos.longitude - reference.longitude) * Math.cos(reference.latitude) * threeRadius,
                (pos.latitude - reference.latitude) * threeRadius,
                (pos.height - reference.height) / earthRadiusMeters * threeRadius
            );
        },
        Mercator: (
            pos: Cartographic, lambda0: number = 0, threeRadius: number = Cartographic.THREE_EARTH_RADIUS): THREE.Vector3 => {
            return new THREE.Vector3(
                (pos.longitude - lambda0) * threeRadius,
                Math.log(Math.tan(Math.PI / 4 + pos.latitude / 2)) * threeRadius,
                pos.height / earthRadiusMeters * threeRadius
            );
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

        constructor(longitude: number = 0, latitude: number = 0, height: number = 0, isRadians: boolean = true) {
            if (!isRadians) {
                latitude *= deg2rad;
                longitude *= deg2rad;
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
                    resultat[name] = mapProjectors[name](that);
                }
            });
            return resultat;
        }
    }

    export interface IConverterLookup {
        [name: string]: (pos: Cartographic) => THREE.Vector3;
    }

    export interface IMapProjector {
        name: string;
        converter: (pos: Cartographic) => THREE.Vector3;
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
