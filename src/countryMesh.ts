namespace shriveling {
    'use strict';

    export interface ICountryTextureURL {
        map: string;
        specularMap: string;
        bumpMap: string;
        normalMap: string;
    }

    export class CountryMesh extends THREE.Mesh {
        public static COUNTRY_TEXTURES: ICountryTextureURL = {
            map: 'assets/earthmap4k.jpg',
            specularMap: 'assets/earthspec4k.jpg',
            bumpMap: 'assets/earthbump4k.jpg',
            normalMap: 'assets/earth_normalmap_flat4k.jpg',
        };
        private static NORMAL_MATERIAL: THREE.Material;
        private _extruded: number = 0;
        private _reprojectName: string;
        private _reprojectIndex: number = -1;
        private _extrudedIndex: number = -1;

        public static generator(geoJson: any, mainProjector: string): CountryMesh[] {
            let resultat: CountryMesh[] = [];
            let loader = new THREE.TextureLoader();

            let earthMaterial = new THREE.MeshPhongMaterial({
                morphTargets: true, opacity: 0.5, depthTest: true, depthWrite: true, transparent: false,
            });
            earthMaterial.map = loader.load(CountryMesh.COUNTRY_TEXTURES.map);
            earthMaterial.specularMap = loader.load(CountryMesh.COUNTRY_TEXTURES.specularMap);
            earthMaterial.specular = new THREE.Color(0x262626);
            earthMaterial.bumpMap = loader.load(CountryMesh.COUNTRY_TEXTURES.bumpMap);
            earthMaterial.bumpScale = 0.15;
            earthMaterial.normalMap = loader.load(CountryMesh.COUNTRY_TEXTURES.normalMap);
            earthMaterial.normalScale = new THREE.Vector2(0.5, 0.7);
            earthMaterial.side = THREE.DoubleSide;
            CountryMesh.NORMAL_MATERIAL = earthMaterial;

            let geometries = CountryGeometry.generator(geoJson, mainProjector);
            geometries.forEach((geometry) => {
                resultat.push(new CountryMesh(geometry));
            });
            return resultat;
        }

        get extruded(): number {
            return this._extruded * 100;
        }

        set extruded(value: number) {
            if (value >= -100 && value <= 100) {
                this._extruded = value / 100;
                (<any>this).morphTargetInfluences[this._extrudedIndex] = this._extruded;
            }
        }

        get properties(): any {
            return (<CountryGeometry>this.geometry).properties;
        }

        set properties(value: any) {
            (<CountryGeometry>this.geometry).properties = value;
        }

        get projection(): string {
            return (<CountryGeometry>this.geometry).projection;
        }

        set projection(value: string) {
            if ((<CountryGeometry>this.geometry).acceptProjection(value)) {
                (<CountryGeometry>this.geometry).projection = value;
                this._reprojectIndex = -1;
                this._extrudedIndex = CountryGeometry.lookupGeometry[value].extruded;
                this.extruded = this.extruded;
            }
        }

        public reProject(value: string | number): void {
            if (typeof value === 'string' && this._reprojectIndex === -1) {
                this._reprojectName = value;
                this._reprojectIndex = CountryGeometry.lookupGeometry[value].none;
                for (let i = 0; i < (<any>this).morphTargetInfluences.length; i++) {
                    (<any>this).morphTargetInfluences[i] = 0;
                }
            }
            if (typeof value === 'number' && this._reprojectIndex > -1
                && value >= 0 && value <= 100 && this._reprojectName !== undefined) {
                (<any>this).morphTargetInfluences[this._reprojectIndex] = value;
                (<THREE.Geometry>this.geometry).elementsNeedUpdate = true;
            }
        }

        private constructor(geometry: CountryGeometry) {
            super(geometry, CountryMesh.NORMAL_MATERIAL);
            this.name = geometry.name;
            this.projection = this.projection;
        }
    }
}
