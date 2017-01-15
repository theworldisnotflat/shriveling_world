namespace shriveling {
    'use strict';

    export class CountryMesh extends THREE.Mesh {
        private _extruded: number = 0;
        private _reprojectName: string;
        private _reprojectIndex: number = -1;
        private _extrudedIndex: number = -1;

        public static generator(geoJson: any, mainProjector: string): CountryMesh[] {
            let resultat: CountryMesh[] = [];

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

        get otherProperties(): any {
            return (<CountryGeometry>this.geometry).otherProperties;
        }

        set otherProperties(value: any) {
            (<CountryGeometry>this.geometry).otherProperties = value;
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

        public isInside(pos: Cartographic): boolean {
            return (<CountryGeometry>this.geometry).isInside(pos);
        }

        private constructor(geometry: CountryGeometry) {
            super(geometry, Configuration.COUNTRY_MATERIAL);
            this.name = geometry.name;
        }
    }
}
