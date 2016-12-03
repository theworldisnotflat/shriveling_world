namespace shriveling {
    'use strict';

    export class ConeMesh extends THREE.Mesh {

        get projection(): string {
            return (<ConeGeometry>this.geometry).projection;
        }

        set projection(value: string) {
            if ((<ConeGeometry>this.geometry).acceptProjection(value)) {
                (<ConeGeometry>this.geometry).projection = value;
            }
        }

        get year(): string {
            return (<ConeGeometry>this.geometry).year;
        }

        set year(value: string) {
            (<ConeGeometry>this.geometry).year = value;
            if ((<ConeGeometry>this.geometry).year === value) {
                this.visible = false;
            }
        }

        public constructor(
            name: string, countryName: string, referential: NEDLocal, base: { [year: string]: IDirection[] },
            boundaryGeometries: CountryGeometry[], projectionName: string, distance: number, withLimit: boolean = true) {
            let geometry = new ConeGeometry(name, countryName, referential, base, boundaryGeometries, projectionName, distance, withLimit);
            super(geometry, Configuration.NORMAL_MATERIAL);
            this.name = geometry.name;
        }
    }
}
