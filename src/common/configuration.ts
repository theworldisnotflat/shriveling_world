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
        public static TWO_PI: number = 2 * Math.PI;
        public static earthRadiusMeters: number = 6371e3;
        public static highLitedMaterial: THREE.Material;
        public static OVER_PI: number = 1 / Math.PI;
        public static OVER_TWO_PI: number = 1 / (2 * Math.PI);
        public static heightRatio: number = 0.01;
        public static intrudedHeightRatio: number = 0.6;
        public static coneStep: number = 15 * Configuration.deg2rad;
        public static extrudedHeight: number = Configuration.earthRadiusMeters * Configuration.intrudedHeightRatio;
        public static hatHeight: number = Configuration.earthRadiusMeters * Configuration.heightRatio;
        public static COUNTRY_TEXTURES: ICountryTextureURL = {
            map: 'assets/earthmap4k.jpg',
            specularMap: 'assets/earthspec4k.jpg',
            bumpMap: 'assets/earthbump4k.jpg',
            normalMap: 'assets/earth_normalmap_flat4k.jpg',
        };
        public static COUNTRY_MATERIAL: THREE.Material;
        public static BASIC_CONE_MATERIAL: THREE.Material;
        public static SKYBOX_URLS: string[] = [
            'assets/px.jpg', 'assets/nx.jpg', 'assets/py.jpg', 'assets/ny.jpg', 'assets/pz.jpg', 'assets/nz.jpg',
        ];
        public static TWEEN_TIMING: number = 1000;
    }
}
