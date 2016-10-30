namespace shriveling {
    'use strict';

    export interface ICountryTextureURL {
        map: string;
        specularMap: string;
        bumpMap: string;
        normalMap: string;
    }

    export class Configuration {
        public static deg2rad: number = Math.PI / 180;
        public static rad2deg: number = 180 / Math.PI;
        public static earthRadiusMeters: number = 6371e3;
        public static highLitedMaterial: THREE.Material =
        new THREE.MeshBasicMaterial({ color: 0xffff00, morphTargets: true, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
        public static OVER_PI: number = 1 / Math.PI;
        public static OVER_TWO_PI: number = 1 / (2 * Math.PI);
        public static COUNTRY_TEXTURES: ICountryTextureURL = {
            map: 'assets/earthmap4k.jpg',
            specularMap: 'assets/earthspec4k.jpg',
            bumpMap: 'assets/earthbump4k.jpg',
            normalMap: 'assets/earth_normalmap_flat4k.jpg',
        };
    }
}
