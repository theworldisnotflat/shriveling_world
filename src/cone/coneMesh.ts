namespace shriveling {
    'use strict';

    export class ConeMesh extends THREE.Mesh {

        private _year: string;

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
            this._year = value;
            this.visible = (<ConeGeometry>this.geometry).year !== this._year;
        }

        set visible(value: boolean) {
            if (this.geometry !== undefined && (<ConeGeometry>this.geometry).year !== undefined) {
                value = value && this._year === (<ConeGeometry>this.geometry).year;
            }
            super.visible = value;
        }

        get withLimits(): boolean {
            return (<ConeGeometry>this.geometry).withLimits;
        }
        set withLimits(value: boolean) {
            (<ConeGeometry>this.geometry).withLimits = value;
        }

        get otherProperties(): any {
            return (<ConeGeometry>this.geometry).otherProperties;
        }
        set otherProperties(value: any) {
            (<ConeGeometry>this.geometry).otherProperties = value;
        }

        get cartographicPosition(): Cartographic {
            return (<ConeGeometry>this.geometry).cartographicPosition;
        }

        public constructor(
            referential: NEDLocal, base: { [year: string]: IDirection[] }, boundaryGeometries: CountryGeometry[],
            projectionName: string, distance: number, withLimit: boolean = true, others: any = {}) {
            let geometry =
                new ConeGeometry(referential, base, boundaryGeometries, projectionName, distance, withLimit, others);
            super(geometry, Configuration.NORMAL_MATERIAL);
        }

        public update(distance?: number, base?: { [year: string]: IDirection[] }): void {
            let year = this.year;
            (<ConeGeometry>this.geometry).update(distance, base);
            this.year = year;
        }

        public regenerateLimits(boundaryGeometries: CountryGeometry[]): void {
            (<ConeGeometry>this.geometry).regenerateLimits(boundaryGeometries);
        }
    }
}
