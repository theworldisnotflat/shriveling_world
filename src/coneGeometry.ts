declare namespace THREE {
    export class CSG {
        public static fromMesh(mesh: THREE.Mesh): CSG;
        public static fromGeometry(geometry: THREE.Geometry): CSG;
        public static toMesh(csg: CSG, material: THREE.Material): THREE.Mesh;
        public static toGeometry(csg: CSG): THREE.Geometry;
        public union(csg: CSG): CSG;
        public subtract(csg: CSG): CSG;
        public intersect(csg: CSG): CSG;
    }
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

    function extrapolerElevation(normalizedBase: IDirection[]): (clock: number) => number {
        let length = normalizedBase.length;
        return (clock: number) => {
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
                out = normalizedBase[index].elevation;
            } else {
                // calcul du ratio
                out = (normalizedBase[indMax].elevation - normalizedBase[indMin].elevation) * (clock - normalizedBase[indMin].clock) /
                    (normalizedBase[indMax].clock - normalizedBase[indMin].clock) + normalizedBase[indMin].elevation;
            }
            return out;
        };
    }

    function direction2Cartographic(base: IDirection[], referential: NEDLocal, distance: number): Cartographic[] {
        let resultat: Cartographic[] = [];
        base = base.sort((a, b) => a.clock - b.clock);
        if (base.length > 0) {
            let maxClock = base[base.length - 1].clock;
            let minClock = base[0].clock;
            if (maxClock - minClock < 2 * Math.PI) {
                maxClock = minClock + Math.PI * 2;
                base.push({ clock: maxClock, elevation: base[0].elevation });
            }
            let elevationFunction = extrapolerElevation(base);
            let elevation: number;
            for (let clock = minClock; clock < maxClock; clock += Configuration.coneStep) {
                elevation = elevationFunction(clock);
                resultat.push(referential.project(clock, elevation, distance));
            }
        }
        return resultat;
    }

    function generateInitialCone(referential: NEDLocal, base: IDirection[], projectionName: string, distance: number): THREE.Geometry {
        let summit = referential.cartoRef;
        let baseCartographic: Cartographic[] = direction2Cartographic(base, referential, distance);
        let uvs: THREE.Vector2[] = [];
        let vertices: THREE.Vector3[] = baseCartographic.map((carto) => {
            uvs.push(new THREE.Vector2(
                carto.longitude * Configuration.OVER_TWO_PI + 0.5,
                carto.latitude * Configuration.OVER_PI + 0.5,
            ));
            return carto.toTHREEVector3(['none'])['none'];
        });
        const n = vertices.length;
        let summitVector3 = summit.toTHREEVector3(['none'])['none'];
        vertices.push(summitVector3);
        let summitUVS = new THREE.Vector2(
            summit.longitude * Configuration.OVER_TWO_PI + 0.5,
            summit.latitude * Configuration.OVER_PI + 0.5,
        );
        uvs.push(summitUVS);
        let faces: THREE.Face3[] = [];
        let faceVertexUvs: THREE.Vector2[][] = [];
        let ia: number, ib: number;
        for (let i = 0; i < n; i++) {
            ia = i; ib = (i + 1) % n;
            faces.push(new THREE.Face3(ia, ib, n));
            faceVertexUvs.push([uvs[ia], uvs[ib], uvs[n]]);
            if (i > 0 && i < n - 1) {
                faces.push(new THREE.Face3(ia, ib, 0));
                faceVertexUvs.push([uvs[ia], uvs[ib], uvs[0]]);
            }
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

    function facetCone(cone: THREE.Geometry, boundaryGeometries: THREE.Geometry[]): THREE.Geometry {
        let coneCSG = THREE.CSG.fromGeometry(cone);
        let faccetedCSG = boundaryGeometries.map((geometry) => {
            let csg = THREE.CSG.fromGeometry(geometry);
            return csg.intersect(coneCSG);
        }).reduce((previous, current) => previous.union(current), THREE.CSG.fromGeometry(new THREE.Geometry()));
        return THREE.CSG.toGeometry(faccetedCSG);
    }

    export class ConeGeometry extends THREE.Geometry {
        public static lookupGeometry: { [projection: string]: number };
        public static reverseLookupGeometry: string[];
        public countryName: string;
        private _projection: string;
        private _premises: ILookupGeometryPremises = {};
        private _selectedYear: string;

        public constructor(
            name: string, countryName: string, referential: NEDLocal, base: { [year: string]: IDirection[] },
            boundaryGeometries: THREE.Geometry[], projectionName: string, distance: number, facet: boolean) {
            super();
            this.name = name;
            this.countryName = countryName;
            for (let year in base) {
                if (base.hasOwnProperty(year)) {
                    let premises = <IGeometryPremises>{};
                    premises.morphTargets = [];
                    let facetedCone = generateInitialCone(referential, base[year], projectionName, distance);
                    if (facet) {
                        facetedCone = facetCone(facetedCone, boundaryGeometries);
                    }
                    let vertices: { [name: string]: THREE.Vector3[] } = {};
                    for (let proj in ConeGeometry.lookupGeometry) {
                        if (ConeGeometry.lookupGeometry.hasOwnProperty(proj)) {
                            vertices[proj] = [];
                        }
                    }
                    facetedCone.vertices.forEach((vertex) => {
                        let multiVertices = Cartographic.fromVector3(vertex, projectionName).toTHREEVector3();
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
                }
            }
            this._projection = projectionName;
            this.year = Object.keys(base)[0];
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

        get year(): string {
            return this._selectedYear;
        }

        set year(value: string) {
            let premise = this._premises[value];
            if (premise !== undefined) {
                let index = ConeGeometry.lookupGeometry[this._projection];
                this._selectedYear = value; // todo pas visible si année différente dans mesh!
                this.faces = premise.faces;
                this.faceVertexUvs = premise.faceVertexUvs;
                this.morphTargets = premise.morphTargets;
                this.vertices = this.morphTargets[index].vertices;

                this.uvsNeedUpdate = true;
                this.normalsNeedUpdate = true;
                this.colorsNeedUpdate = true;
                this.verticesNeedUpdate = true;
                this.elementsNeedUpdate = true;

                this.computeMorphNormals();
                this.computeBoundingBox();
                this.computeBoundingSphere();
            }
        }

        public acceptProjection(value: string): boolean {
            return ConeGeometry.lookupGeometry.hasOwnProperty(value) && this._premises.hasOwnProperty(this._selectedYear);
        }

    }
}
