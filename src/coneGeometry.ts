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
    interface ICoordinates {
        x: number;
        y: number;
        z: number;
    }
    interface IReferential {
        sommet: ICoordinates;
        normal: ICoordinates;
        east: ICoordinates;
        north: ICoordinates;
    }
    interface IGeometryPremises {
        faceVertexUvs: THREE.Vector2[][][];
        faces: THREE.Face3[];
        morphTargets: THREE.MorphTarget[];
    }
    interface ILookupGeometryPremises {
        [year: string]: IGeometryPremises;
    }

    function generateReferential(summit: Cartographic): IReferential {
        let sommet: ICoordinates = {
            x: Math.cos(summit.longitude) * Configuration.earthRadiusMeters * Math.cos(summit.latitude),
            y: Math.sin(summit.latitude) * Configuration.earthRadiusMeters,
            z: Math.sin(summit.longitude) * Configuration.earthRadiusMeters * Math.cos(summit.latitude),
        };
        let normal: ICoordinates = {
            x: sommet.x / Configuration.earthRadiusMeters,
            y: sommet.y / Configuration.earthRadiusMeters,
            z: sommet.z / Configuration.earthRadiusMeters,
        };
        let normEast = Math.sqrt(normal.x * normal.x + normal.y * normal.y);
        let east: ICoordinates = {
            x: -normal.y / normEast,
            y: normal.x / normEast,
            z: 0,
        };
        let north: ICoordinates = {
            x: normal.y * east.z - normal.z * east.y,
            y: normal.z * east.x - normal.x * east.z,
            z: normal.x * east.y - normal.y * east.x,
        };
        let normNorth = Math.sqrt(north.x * north.x + north.y * north.y + north.z * north.z);
        north.x = north.x / normNorth; north.y = north.y / normNorth; north.z = north.z / normNorth;

        return { sommet: sommet, normal: normal, east: east, north: north };
    }

    function projectPart(referential: IReferential, begin: IDirection, end: IDirection): Cartographic[] {
        let resultat: ICoordinates[] = [];
        let deltaClock = end.clock - begin.clock;
        let sign = Math.sign(deltaClock);
        function elevation(clock: number): number {
            let r: number = begin.elevation;
            if (Math.abs(deltaClock) > 1e13) {
                let t = (clock - begin.clock) / deltaClock;
                r = (1 - t) * begin.elevation + t * end.elevation;
            }
            return r;
        }
        let el: number;
        let sommet = referential.sommet;
        let normal = referential.normal;
        let east = referential.east;
        let north = referential.north;
        let cosClock: number, cosEl: number, sinClock: number, sinEl: number;
        for (
            let clock = begin.clock; Math.abs(clock - end.clock) > Configuration.coneStep; clock += sign = Configuration.coneStep) {
            el = elevation(clock);
            cosClock = Math.cos(clock); cosEl = Math.cos(el); sinClock = Math.sin(clock); sinEl = Math.sin(el);
            resultat.push({
                x: sommet.x + (cosClock * cosEl * east.x + sinClock * cosEl * north.x - sinEl * normal.x)
                * Configuration.extrudedHeight,
                y: sommet.y + (cosClock * cosEl * east.y + sinClock * cosEl * north.y - sinEl * normal.y)
                * Configuration.extrudedHeight,
                z: sommet.z + (cosClock * cosEl * east.z + sinClock * cosEl * north.z - sinEl * normal.z)
                * Configuration.extrudedHeight,
            });
        }

        return resultat.map((coordinate) => {
            let out = new Cartographic();
            let radius = Math.sqrt(coordinate.x * coordinate.x + coordinate.y * coordinate.y + coordinate.z * coordinate.z);
            out.height = radius - Configuration.earthRadiusMeters;
            out.longitude = Math.atan2(coordinate.z, coordinate.x);
            let cos = Math.cos(out.longitude);
            let sin = Math.sin(out.longitude);
            if (Math.abs(sin) > 1e-13) {
                out.latitude = Math.atan2(coordinate.y, coordinate.z / sin);
            } else if (Math.abs(cos) > 1e-13) {
                out.latitude = Math.atan2(coordinate.y, coordinate.x / cos);
            } else {
                out.latitude = Math.asin(coordinate.y);
            }
            return out;
        });
    }

    function generateInitialCone(
        summit: Cartographic, referential: IReferential, base: IDirection[], projectionName: string): THREE.Geometry {
        base = base.sort((a, b) => a.clock - b.clock);
        base.push({ clock: base[0].clock + Math.PI * 2, elevation: base[0].elevation });
        let baseCartographic: Cartographic[] = [];
        for (let i = 0; i < base.length - 2; i++) {
            baseCartographic.push(...projectPart(referential, base[i], base[i + 1]));
        }
        let uvs: THREE.Vector2[] = [];
        let vertices: THREE.Vector3[] = baseCartographic.map((carto) => {
            uvs.push(new THREE.Vector2(
                carto.longitude * Configuration.OVER_TWO_PI + 0.5,
                carto.latitude * Configuration.OVER_PI + 0.5
            ));
            return carto.toTHREEVector3(['none'])['none'];
        });
        const n = vertices.length;
        let summitVector3 = summit.toTHREEVector3(['none'])['none'];
        vertices.push(summitVector3);
        let summitUVS = new THREE.Vector2(
            summit.longitude * Configuration.OVER_TWO_PI + 0.5,
            summit.latitude * Configuration.OVER_PI + 0.5
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
            name: string, countryName: string, summit: Cartographic, base: { [year: string]: IDirection[] },
            boundaryGeometries: THREE.Geometry[], projectionName: string, facet: boolean) {
            super();
            this.name = name;
            this.countryName = countryName;
            let referential = generateReferential(summit);
            for (let year in base) {
                if (base.hasOwnProperty(year)) {
                    let premises = <IGeometryPremises>{};
                    premises.morphTargets = [];
                    let facetedCone = generateInitialCone(summit, referential, base[year], projectionName);
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
