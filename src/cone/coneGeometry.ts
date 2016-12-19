declare class ThreeBSP {
    public constructor(geo: THREE.Geometry | THREE.Mesh);
    public subtract(a: ThreeBSP): ThreeBSP;
    public union(a: ThreeBSP): ThreeBSP;
    public intersect(a: ThreeBSP): ThreeBSP;
    public toMesh(material: THREE.Material): THREE.Mesh;
    public toGeometry(): THREE.Geometry;
}

namespace shriveling {
    'use strict';
    interface IGeometryPremises {
        faceVertexUvs: THREE.Vector2[][][];
        faces: THREE.Face3[];
        morphTargets: THREE.MorphTarget[];
    }
    interface ILookupGeometryPremises {
        [year: string]: IGeometryPremises;
    }

    function extrapoler(normalizedBase: IClock[], property: string): (clock: number) => number {
        let length = normalizedBase.length;
        let resultat = (clock: number) => 0;
        if (length > 0) {
            resultat = (clock: number) => {
                let indMin = 0;
                let indMax = length - 1;
                let index = Math.floor(length / 2);
                let found = false;
                let out = 0;
                if (clock < normalizedBase[0].clock) {
                    index = 0;
                    found = true;
                }
                if (clock > normalizedBase[length - 1].clock) {
                    index = indMax;
                    indMin = indMax - 1;
                    found = false;
                }
                while ((indMax !== indMin + 1) && !(found)) {
                    if (normalizedBase[index].clock === clock) {
                        indMin = index;
                        indMax = index;
                        found = true;
                    } else {
                        if (normalizedBase[index].clock < clock) {
                            indMin = index;
                        } else {
                            if (normalizedBase[index].clock > clock) {
                                indMax = index;
                            }
                        }
                    }
                    index = Math.floor((indMin + indMax) / 2);
                }
                if (found) {
                    out = normalizedBase[index][property];
                } else {
                    // calcul du ratio
                    out = (normalizedBase[indMax][property] - normalizedBase[indMin][property]) * (clock - normalizedBase[indMin].clock) /
                        (normalizedBase[indMax].clock - normalizedBase[indMin].clock) + normalizedBase[indMin][property];
                }
                return out;
            };
        }
        return resultat;
    }

    function direction2Cartographic(
        base: IDirection[], referential: NEDLocal, distanceMax: number,
        boundaryFunction: (clock: number) => number, withLimits: boolean): Cartographic[] {
        let resultat: Cartographic[] = [];
        base = base.sort((a, b) => a.clock - b.clock);
        if (base.length > 0) {
            let maxClock = base[base.length - 1].clock;
            let minClock = base[0].clock;
            if (maxClock - minClock < Configuration.TWO_PI) {
                maxClock = minClock + Configuration.TWO_PI;
                base.push({ clock: maxClock, elevation: base[0].elevation });
            }
            let elevationFunction = extrapoler(base, 'elevation');
            let elevation: number;
            let distance: number;
            let cosEl: number;
            for (let clock = minClock; clock < maxClock; clock += Configuration.coneStep) {
                elevation = elevationFunction(clock);
                cosEl = Math.cos(elevation);
                if (withLimits && cosEl > 0) {
                    distance = Math.min(distanceMax, boundaryFunction(clock) / cosEl);
                } else {
                    distance = distanceMax;
                }
                resultat.push(referential.project(clock, elevation, distance));
            }
        }
        return resultat;
    }

    function getLocalLimits(
        boundaries: CountryGeometry[], referential: NEDLocal): { clock: number, distance: number }[] {
        let allPoints: Coordinate[] = [];
        boundaries.forEach((country) => {
            country.boundary.forEach((position) => {
                allPoints.push(referential.cartographic2NED(position));
            });
        });
        let clockDistance = allPoints.map((pos) => {
            return { clock: Math.atan2(pos.y, pos.x), distance: Math.sqrt(pos.x * pos.x + pos.y * pos.y + pos.z * pos.z) };
        }).reduce(
            (result, current) => {
                let clockClass = Math.floor(current.clock / Configuration.coneStep) * Configuration.coneStep;
                result[clockClass] = result[clockClass] === undefined ? current.distance : Math.min(result[clockClass], current.distance);
                return result;
            },
            {});
        let resultat: { clock: number, distance: number }[] = [];
        for (let clockString in clockDistance) {
            if (clockDistance.hasOwnProperty(clockString)) {
                resultat.push({ clock: parseFloat(clockString), distance: clockDistance[clockString] });
            }
        }
        let length = resultat.length;
        let temp: { clock: number, distance: number };
        for (let i = 0; i < length; i++) {
            temp = resultat[i];
            resultat.push(
                { clock: temp.clock - Configuration.TWO_PI, distance: temp.distance },
                { clock: temp.clock + Configuration.TWO_PI, distance: temp.distance });
        }
        return resultat.sort((a, b) => a.clock - b.clock);
    }

    function generateInitialCone(
        referential: NEDLocal, base: IDirection[], projectionName: string, distance: number,
        boundaryFunction: (clock: number) => number, withLimits: boolean): THREE.Geometry {
        let summit = referential.cartoRef;
        let baseCartographic: Cartographic[] = direction2Cartographic(base, referential, distance, boundaryFunction, withLimits);
        const n = baseCartographic.length;
        let uvs: THREE.Vector2[] = [];
        let centerDown = new Cartographic(summit.longitude, summit.latitude, 0, true);
        let vertices: THREE.Vector3[] = baseCartographic.map((carto) => {
            centerDown.height += carto.height / n;
            uvs.push(new THREE.Vector2(
                carto.longitude * Configuration.OVER_TWO_PI + 0.5,
                carto.latitude * Configuration.OVER_PI + 0.5,
            ));
            return carto.toTHREEVector3(['none'])['none'];
        });
        let summitVector3 = summit.toTHREEVector3(['none'])['none'];
        let centerDownVector3 = centerDown.toTHREEVector3(['none'])['none'];
        vertices.push(summitVector3);
        vertices.push(centerDownVector3);
        let summitUVS = new THREE.Vector2(
            summit.longitude * Configuration.OVER_TWO_PI + 0.5,
            summit.latitude * Configuration.OVER_PI + 0.5,
        );
        let centerDownUVS = new THREE.Vector2(
            centerDown.longitude * Configuration.OVER_TWO_PI + 0.5,
            centerDown.latitude * Configuration.OVER_PI + 0.5,
        );
        uvs.push(summitUVS);
        uvs.push(centerDownUVS);
        let faces: THREE.Face3[] = [];
        let faceVertexUvs: THREE.Vector2[][] = [];
        let ia: number, ib: number;
        for (let i = 0; i < n; i++) {
            ia = i; ib = (i + 1) % n;
            faces.push(new THREE.Face3(ia, ib, n));
            faceVertexUvs.push([uvs[ia], uvs[ib], uvs[n]]);
            faces.push(new THREE.Face3(ia, ib, n + 1));
            faceVertexUvs.push([uvs[ia], uvs[ib], uvs[n + 1]]);
        }
        let resultat = new THREE.Geometry();
        resultat.vertices = vertices;
        resultat.faces = faces;
        resultat.faceVertexUvs[0] = faceVertexUvs;
        resultat.uvsNeedUpdate = true;
        resultat.normalsNeedUpdate = true;
        resultat.verticesNeedUpdate = true;
        resultat.elementsNeedUpdate = true;

        return resultat;
    }

    export class ConeGeometry extends THREE.Geometry {
        public static lookupGeometry: { [projection: string]: number };
        public static reverseLookupGeometry: string[];
        public otherProperties: any;
        private _projection: string;
        private _premises: ILookupGeometryPremises = {};
        private _selectedYear: string;
        private _maxDistanceFunction: (clock: number) => number;
        private _baseData: { [year: string]: IDirection[] };
        private _referential: NEDLocal;
        private _withLimits: boolean;
        private _distance: number;

        public constructor(
            referential: NEDLocal, base: { [year: string]: IDirection[] }, boundaryGeometries: CountryGeometry[],
            projectionName: string, distance: number, withLimits: boolean, others: any = {}) {
            super();
            this._referential = referential;
            this._maxDistanceFunction = extrapoler(getLocalLimits(boundaryGeometries, this._referential), 'distance');
            this._projection = projectionName;
            this._withLimits = withLimits;
            this.otherProperties = others;
            this.update(distance, base);
            this._selectedYear = Object.keys(base)[0];
        }

        get projection(): string {
            return this._projection;
        }

        set projection(value: string) {
            if (this.acceptProjection(value)) {
                this._projection = value;
                let index = ConeGeometry.lookupGeometry[value];
                this.vertices = this.morphTargets[index].vertices;
                this.computeMorphNormals();
                this.verticesNeedUpdate = true;
                this.elementsNeedUpdate = true;
                this.computeBoundingBox();
                this.computeBoundingSphere();
            }
        }

        get cartographicPosition(): Cartographic {
            return this._referential.cartoRef;
        }

        get year(): string {
            return this._selectedYear;
        }

        get withLimits(): boolean {
            return this._withLimits;
        }

        set withLimits(value: boolean) {
            this._withLimits = value;
            this.update();
        }

        set year(value: string) {
            let premise = this._premises[value];
            if (premise !== undefined) {
                let index = ConeGeometry.lookupGeometry[this._projection];
                this._selectedYear = value;
                this.faces = premise.faces;
                this.faceVertexUvs = premise.faceVertexUvs;
                this.morphTargets = premise.morphTargets;
                this.vertices = this.morphTargets[index].vertices;
            } else {
                this.faces = [];
                this.faceVertexUvs[0] = [];
                this.morphTargets = [];
                this.vertices = [];
            }

            this.uvsNeedUpdate = true;
            this.normalsNeedUpdate = true;
            this.colorsNeedUpdate = true;
            this.verticesNeedUpdate = true;
            this.elementsNeedUpdate = true;

            this.computeMorphNormals();
            this.computeBoundingBox();
            this.computeBoundingSphere();
        }

        public fuzzyClone(): THREE.Geometry {
            let geometry = this.clone();
            geometry.morphTargets = this.morphTargets;
            return geometry;
        }

        public update(distance: number = this._distance, base: { [year: string]: IDirection[] } = this._baseData): void {
            this._baseData = base;
            this._distance = distance;
            for (let year in this._baseData) {
                if (this._baseData.hasOwnProperty(year)) {
                    let premises = <IGeometryPremises>{};
                    premises.morphTargets = [];
                    let facetedCone = generateInitialCone(
                        this._referential, this._baseData[year], 'none', distance, this._maxDistanceFunction, this._withLimits);
                    let vertices: { [name: string]: THREE.Vector3[] } = {};
                    for (let proj in ConeGeometry.lookupGeometry) {
                        if (ConeGeometry.lookupGeometry.hasOwnProperty(proj)) {
                            vertices[proj] = [];
                        }
                    }
                    facetedCone.vertices.forEach((vertex) => {
                        let multiVertices = Cartographic.fromVector3(vertex, 'none').toTHREEVector3();
                        for (let proj in ConeGeometry.lookupGeometry) {
                            if (multiVertices.hasOwnProperty(proj)) {
                                vertices[proj].push(multiVertices[proj]);
                            }
                        }
                    });
                    let reverse: string;
                    for (let i = 0; i < ConeGeometry.reverseLookupGeometry.length; i++) {
                        reverse = ConeGeometry.reverseLookupGeometry[i];
                        premises.morphTargets.push({ name: reverse, vertices: vertices[reverse] });
                    }
                    premises.faces = facetedCone.faces;
                    premises.faceVertexUvs = facetedCone.faceVertexUvs;
                    this._premises[year] = premises;
                    this._selectedYear = year;
                }
            }
            this.year = this.year;
        }

        public regenerateLimits(boundaryGeometries: CountryGeometry[]): void {
            this._maxDistanceFunction = extrapoler(getLocalLimits(boundaryGeometries, this._referential), 'distance');
            this.update();
        }

        public acceptProjection(value: string): boolean {
            return ConeGeometry.lookupGeometry.hasOwnProperty(value) && this._premises.hasOwnProperty(this._selectedYear);
        }
    }
}
