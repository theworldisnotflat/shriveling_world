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
        public static highLitedMaterial: THREE.Material =
        new THREE.MeshBasicMaterial({ color: 0xffff00, morphTargets: true, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
        public static OVER_PI: number = 1 / Math.PI;
        public static OVER_TWO_PI: number = 1 / (2 * Math.PI);
        public static heightRatio: number = 0.01;
        public static intrudedHeightRatio: number = 0.8;
        public static coneStep: number = 5 * Configuration.deg2rad;
        public static extrudedHeight: number = - Configuration.earthRadiusMeters * Configuration.intrudedHeightRatio;
        public static hatHeight: number = Configuration.earthRadiusMeters * Configuration.heightRatio;
        public static COUNTRY_TEXTURES: ICountryTextureURL = {
            map: 'assets/earthmap4k.jpg',
            specularMap: 'assets/earthspec4k.jpg',
            bumpMap: 'assets/earthbump4k.jpg',
            normalMap: 'assets/earth_normalmap_flat4k.jpg',
        };
        public static NORMAL_MATERIAL: THREE.Material;

        public static prepareConfiguration(): void {
            if (Configuration.NORMAL_MATERIAL === undefined) {
                let loader = new THREE.TextureLoader();

                let earthMaterial = new THREE.MeshPhongMaterial({
                    morphTargets: true, opacity: 0.5, depthTest: true, depthWrite: true, transparent: false,
                });
                earthMaterial.map = loader.load(Configuration.COUNTRY_TEXTURES.map);
                earthMaterial.specularMap = loader.load(Configuration.COUNTRY_TEXTURES.specularMap);
                earthMaterial.specular = new THREE.Color(0x262626);
                earthMaterial.bumpMap = loader.load(Configuration.COUNTRY_TEXTURES.bumpMap);
                earthMaterial.bumpScale = 0.15;
                earthMaterial.normalMap = loader.load(Configuration.COUNTRY_TEXTURES.normalMap);
                earthMaterial.normalScale = new THREE.Vector2(0.5, 0.7);
                earthMaterial.side = THREE.DoubleSide;
                Configuration.NORMAL_MATERIAL = earthMaterial;
            }
            if (ConeGeometry.lookupGeometry === undefined) {
                ConeGeometry.lookupGeometry = {};
                let count = 0;
                ConeGeometry.reverseLookupGeometry = [];
                for (let name in mapProjectors) {
                    if (mapProjectors.hasOwnProperty(name)) {
                        ConeGeometry.lookupGeometry[name] = count;
                        ConeGeometry.reverseLookupGeometry.push(name);
                        count++;
                    }
                }
            }
        }
    }
}
