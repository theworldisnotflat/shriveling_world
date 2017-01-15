namespace shriveling {
    'use strict';

    export interface ITypeExtrusion {
        none: number;
        extruded: number;
    }

    interface IReverseLookupExtrusion {
        projection: string;
        extruded: boolean;
    }

    interface IPreGeometry {
        faceVertexUvs: THREE.Vector2[][];
        faces: THREE.Face3[];
        morphs: { [name: string]: THREE.Vector3[] };
        verticesExtruded: THREE.Vector3[];
        morphsExtruded: { [name: string]: THREE.Vector3[] };
        surfaceBoundary: Cartographic[];
    }

    interface IVerticesTriangles {
        vertices: Cartographic[];
        polygons: number[][];
        triangles: number[];
        surfaceBoundary: Cartographic[];
    }

    function cnPnPolyIsIn(P: number[], V: number[][]): boolean {
        let cn = 0;    // the  crossing number counter
        let iplus: number, n = V.length;
        // loop through all edges of the polygon
        for (let i = 0; i < n; i++) {    // edge from V[i]  to V[i+1]
            iplus = (i === n - 1) ? 0 : i + 1;
            if (((V[i][1] <= P[1]) && (V[iplus][1] > P[1]))
                || ((V[i][1] > P[1]) && (V[iplus][1] <= P[1]))) {
                let vt = (P[1] - V[i][1]) / (V[iplus][1] - V[i][1]);
                if (P[0] < V[i][0] + vt * (V[iplus][0] - V[i][0])) {
                    cn++;
                }
            }
        }
        return cn % 2 === 1;    // 0 if even (out), and 1 if  odd (in)
    }

    function generateSteinerPointsFor(poly: number[][]): poly2tri.Point[] {
        let resultat: poly2tri.Point[] = [];
        if (poly.length > 2) {
            const discriminant = 3;
            let minx = 1e23, maxx = -1e23;
            let miny = 1e23, maxy = -1e23;

            let i: number;
            for (i = 0; i < poly.length; i++) {
                let p = poly[i];
                minx = Math.min(minx, p[0]); miny = Math.min(miny, p[1]);
                maxx = Math.max(maxx, p[0]); maxy = Math.max(maxy, p[1]);
            }
            let temp: number[], fx: number, fy: number;
            for (let x = minx; x < maxx; x += discriminant) {
                for (let y = miny; y < maxy; y += discriminant) {
                    fx = x + (0.5 - Math.random()) / 2 * discriminant;
                    fy = y + (0.5 - Math.random()) / 2 * discriminant;
                    temp = [fx, fy];
                    if (cnPnPolyIsIn(temp, poly)) {
                        resultat.push(new poly2tri.Point(fx, fy));
                    }
                }

            }
        }
        return resultat;
    }

    function generateVertices(geometry: GeoJSON.GeometryObject): IVerticesTriangles[] {
        let coordinates: number[][][][] = [[[[]]]];
        switch (geometry.type) {
            case 'Polygon':
                coordinates = [geometry.coordinates];
                break;
            case 'MultiPolygon':
                coordinates = geometry.coordinates;
                break;
            default:
        }
        return coordinates.map((polygonWithHoles) => {
            let steinerPoints: poly2tri.Point[];
            let holes: poly2tri.Point[][] = [];
            let contour: poly2tri.Point[];
            polygonWithHoles = polygonWithHoles.map((polygon, index) => {
                let cleanedBoundaries = cleanBoundaries(polygon);
                if (index === 0) {
                    steinerPoints = generateSteinerPointsFor(cleanedBoundaries);
                    contour = cleanedBoundaries.map((item) => new poly2tri.Point(item[0], item[1]));
                } else {
                    holes.push(cleanedBoundaries.map((item) => new poly2tri.Point(item[0], item[1])));
                }
                return cleanedBoundaries;
            });

            let swctx = new poly2tri.SweepContext(contour);
            swctx.addHoles(holes);
            swctx.addPoints(steinerPoints);
            swctx.triangulate();
            let triangles = swctx.getTriangles();
            let resultat: IVerticesTriangles = { vertices: [], polygons: [], triangles: [], surfaceBoundary: [] };
            let verticesPoly2Tri: poly2tri.IPointLike[] = [];

            function findAndAddVertexIndex(p: poly2tri.IPointLike): number {
                let vs = verticesPoly2Tri;
                let out = -1;
                for (let k = 0; k < vs.length; k++) {
                    if (Math.abs(vs[k].x - p.x) + Math.abs(vs[k].y - p.y) < 1e-5) {
                        out = k;
                    }
                }
                if (out === -1) {
                    vs.push(p);
                    out = vs.length - 1;
                }
                return out;
            }
            resultat.polygons.push(contour.map(findAndAddVertexIndex));
            // add holes in the vertices and hole indexes
            holes.forEach((hole) => {
                resultat.polygons.push(hole.map(findAndAddVertexIndex));
            });

            triangles.forEach((triangle) => {
                resultat.triangles.push(findAndAddVertexIndex(triangle.getPoint(0)));
                resultat.triangles.push(findAndAddVertexIndex(triangle.getPoint(1)));
                resultat.triangles.push(findAndAddVertexIndex(triangle.getPoint(2)));
            });
            resultat.surfaceBoundary = contour.map((point) => new Cartographic(point.x, point.y, 0, false));
            resultat.vertices = verticesPoly2Tri.map((v) => new Cartographic(v.x, v.y, 0, false));
            return resultat;
        });
    }

    function cleanBoundaries(polygon: number[][]): number[][] {
        let i: number, done = false, p, q, o, a, b, dx, dy, d, n, xj, yj, j;
        while (!done) {
            done = true;
            // remove duplicates
            for (i = 0; i < polygon.length; i++) {
                p = polygon[i];
                q = polygon[(i + 1) % polygon.length];
                if (Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) < 1e-5) {
                    polygon.splice(i, 1);
                    i = Math.max(-1, i - 2);
                    done = false;
                }
            }
            // remove collinear edges
            for (i = 0; i < polygon.length; i++) {
                o = polygon[(i - 1 + polygon.length) % polygon.length];
                p = polygon[i];
                q = polygon[(i + 1) % polygon.length];
                a = { x: o[0] - p[0], y: o[1] - p[1] };
                b = { x: q[0] - p[0], y: q[1] - p[1] };
                if (Math.abs(
                    (a.x * b.x + a.y * b.y) /
                    Math.sqrt((a.x * a.x + a.y * a.y) * (b.x * b.x + b.y * b.y))) > 1 - 1e-5) {
                    polygon.splice(i, 1);
                    i = Math.max(-1, i - 2);
                    done = false;
                }
            }
        }
        for (i = 0; i < polygon.length; 0) {
            p = polygon[i];
            q = polygon[(i + 1) % polygon.length];
            dx = q[0] - p[0];
            dy = q[1] - p[1];
            d = Math.sqrt(dx * dx + dy * dy);
            n = Math.ceil(d / 7); // one point every ~7°
            for (j = 1; j < n; j++) {
                // we add orthogonal vector at every 2nd point to create non-collinear edges
                xj = p[0] + dx * j / n - dy * (j % 2) * 1e-6;
                yj = p[1] + dy * j / n + dx * (j % 2) * 1e-6;
                polygon.splice(i + j, 0, [xj, yj]);
            }
            i += n;
        }

        // there can stll be zero-area triangles between poly and hole
        // this attempts to reduce the probability of such a situation
        for (i = 0; i < polygon.length; i++) {
            polygon[i][0] += 1e-9 * Math.random();
            polygon[i][1] += 1e-9 * Math.random();
        }

        return polygon;
    }

    function prepareGeometry(verticesAndTriangles: IVerticesTriangles, mainProjector: string): IPreGeometry {
        let resultat: IPreGeometry = <IPreGeometry>{};
        let cartoVertices = verticesAndTriangles.vertices;
        let cartoVerticesExtruded: Cartographic[] = [...cartoVertices];
        let polygons = verticesAndTriangles.polygons;
        let triangles = verticesAndTriangles.triangles;
        let vertices: { [name: string]: THREE.Vector3[] } = {};
        let verticesExtruded: { [name: string]: THREE.Vector3[] } = {};
        let uvs: THREE.Vector2[] = [];
        let faces: THREE.Face3[] = [];
        let faceVertexUvs: THREE.Vector2[][] = [];
        const n = cartoVertices.length;

        for (let name in mapProjectors) {
            if (mapProjectors.hasOwnProperty(name)) {
                vertices[name] = [];
                verticesExtruded[name] = [];
            }
        }
        // extruded
        let cartoHat: Cartographic;
        for (let i = 0; i < n; i++) {
            let carto = cartoVertices[i];

            cartoHat = carto.clone();
            cartoHat.height = Configuration.hatHeight;
            cartoVertices.push(cartoHat);

            cartoHat = carto.clone();
            cartoHat.height = -Configuration.extrudedHeight;
            cartoVerticesExtruded.push(cartoHat);

            uvs.push(new THREE.Vector2(
                carto.longitude * Configuration.OVER_TWO_PI + 0.5,
                carto.latitude * Configuration.OVER_PI + 0.5,
            ));
        }

        cartoVertices.forEach((carto) => {
            let lookupPos = <{ [x: string]: THREE.Vector3 }>carto.toTHREEVector3();
            for (let name in vertices) {
                if (lookupPos.hasOwnProperty(name) && vertices.hasOwnProperty(name)) {
                    vertices[name].push(lookupPos[name]);
                }
            }
        });
        cartoVerticesExtruded.forEach((carto) => {
            let lookupPos = <{ [x: string]: THREE.Vector3 }>carto.toTHREEVector3();
            for (let name in verticesExtruded) {
                if (lookupPos.hasOwnProperty(name) && verticesExtruded.hasOwnProperty(name)) {
                    verticesExtruded[name].push(lookupPos[name]);
                }
            }
        });
        let initVertices = vertices[mainProjector];
        // tesselation for below and above !!
        for (let i = 0; i < triangles.length; i += 3) {
            let a = triangles[i];
            let b = triangles[i + 1];
            let c = triangles[i + 2];

            faces.push(new THREE.Face3(a, b, c));
            faceVertexUvs.push([uvs[a], uvs[b], uvs[c]]);

            faces.push(new THREE.Face3(n + b, n + a, n + c));
            faceVertexUvs.push([uvs[b], uvs[a], uvs[c]]);
        }

        let ia: number, ib: number, va1: THREE.Vector3,
            vb1: THREE.Vector3, va2: THREE.Vector3, vb2: THREE.Vector3, normal: THREE.Vector3;
        let mainPolygon = polygons[0];
        let holePolygons = polygons.slice(1);

        for (let i = 0; i < mainPolygon.length; i++) {
            ia = mainPolygon[i]; ib = mainPolygon[(i + 1) % mainPolygon.length];
            va1 = initVertices[ia]; vb1 = initVertices[ib];
            va2 = initVertices[n + ia]; vb2 = initVertices[n + ib];
            normal = vb1.clone().sub(va1).cross(va2.clone().sub(va1)).normalize();
            faces.push(new THREE.Face3(ia, ib, n + ia, [normal, normal, normal]));
            faceVertexUvs.push([uvs[ia], uvs[ib], uvs[ia]]);
            faces.push(new THREE.Face3(ib, n + ib, n + ia, [normal, normal, normal]));
            faceVertexUvs.push([uvs[ib], uvs[ib], uvs[ia]]);
        }
        holePolygons.forEach((holeIndexes) => {
            for (let i = 0; i < holeIndexes.length; i++) {
                ia = holeIndexes[i]; ib = holeIndexes[(i + 1) % holeIndexes.length];
                va1 = initVertices[ia]; vb1 = initVertices[ib];
                va2 = initVertices[n + ia]; vb2 = initVertices[n + ib];
                normal = va2.clone().sub(va1).cross(vb1.clone().sub(va1)).normalize();
                faces.push(new THREE.Face3(ib, ia, n + ia, [normal, normal, normal]));
                faceVertexUvs.push([uvs[ib], uvs[ia], uvs[ia]]);
                faces.push(new THREE.Face3(ib, n + ia, n + ib, [normal, normal, normal]));
                faceVertexUvs.push([uvs[ib], uvs[ia], uvs[ib]]);
            }
        });

        resultat.morphs = vertices;
        resultat.morphsExtruded = verticesExtruded;
        resultat.faceVertexUvs = faceVertexUvs;
        resultat.faces = faces;
        return resultat;
    }

    export class CountryGeometry extends THREE.Geometry {
        public static lookupGeometry: { [projection: string]: ITypeExtrusion } = {};
        public otherProperties: any;
        private _boundaryBox: IBBox;
        private _projection: string;

        public static generator(geoJson: any, mainProjector: string): CountryGeometry[] {
            let resultat: CountryGeometry[] = [];
            if (geoJson.type === 'FeatureCollection') {
                if (!mapProjectors.hasOwnProperty(mainProjector)) {
                    mainProjector = Object.keys(mapProjectors)[0];
                }
                CountryGeometry.lookupGeometry = {};
                let count = 0;
                let reverseLookup: IReverseLookupExtrusion[] = [];
                for (let name in mapProjectors) {
                    if (mapProjectors.hasOwnProperty(name)) {
                        CountryGeometry.lookupGeometry[name] = <ITypeExtrusion>{};
                        CountryGeometry.lookupGeometry[name].none = count;
                        reverseLookup.push({ projection: name, extruded: false });
                        count++;
                        CountryGeometry.lookupGeometry[name].extruded = count;
                        reverseLookup.push({ projection: name, extruded: true });
                        count++;
                    }
                }
                (<GeoJSON.FeatureCollection<GeoJSON.GeometryObject>>geoJson).features.forEach((feature) => {
                    let properties = feature.properties;
                    generateVertices(feature.geometry).forEach((item, index) => {
                        resultat.push(new CountryGeometry(properties, item, mainProjector, reverseLookup));
                    });
                });
            } else {
                throw new Error('not a geoJson');
            }
            return resultat;
        }

        get projection(): string {
            return this._projection;
        }

        get bbox(): IBBox {
            return this._boundaryBox;
        }

        set projection(value: string) {
            if (this.acceptProjection(value)) {
                this._projection = value;
                let index = CountryGeometry.lookupGeometry[value].none;
                this.vertices = this.morphTargets[index].vertices;
                this.computeMorphNormals();
                this.verticesNeedUpdate = true;
                this.elementsNeedUpdate = true;
                this.computeBoundingBox();
                this.computeBoundingSphere();
            }
        }

        public acceptProjection(value: string): boolean {
            return CountryGeometry.lookupGeometry.hasOwnProperty(value);
        }

        public fuzzyClone(): THREE.Geometry {
            let geometry = this.clone();
            geometry.morphTargets = this.morphTargets;
            return geometry;
        }

        public isInside(pos: Cartographic): boolean {
            let resultat = false;
            if (pos.latitude >= this._boundaryBox.minLat && pos.latitude <= this._boundaryBox.maxLat &&
                pos.longitude >= this._boundaryBox.minLong && pos.longitude <= this._boundaryBox.maxLong) {
                resultat = Cartographic.isInside(pos, this._boundaryBox.boundary);
            }
            return resultat;
        }

        private constructor(
            properties: any, boundary: IVerticesTriangles, mainProjector: string, reverseLookup: IReverseLookupExtrusion[]) {
            super();
            this.otherProperties = properties;
            this._boundaryBox = { minLat: 1000, minLong: 1000, maxLat: -1000, maxLong: -1000, boundary: boundary.surfaceBoundary };
            for (let i = 0; i < this._boundaryBox.boundary.length; i++) {
                let pos = this._boundaryBox.boundary[i];
                this._boundaryBox.minLong = Math.min(this._boundaryBox.minLong, pos.longitude);
                this._boundaryBox.minLat = Math.min(this._boundaryBox.minLat, pos.latitude);
                this._boundaryBox.maxLong = Math.max(this._boundaryBox.maxLong, pos.longitude);
                this._boundaryBox.maxLat = Math.max(this._boundaryBox.maxLat, pos.latitude);
            }
            let preparedGeometry = prepareGeometry(boundary, mainProjector);
            this.morphTargets = [];
            let list: THREE.Vector3[], reverse: IReverseLookupExtrusion, morphName: string;
            for (let i = 0; i < reverseLookup.length; i++) {
                reverse = reverseLookup[i];
                morphName = reverse.projection + reverse.extruded;
                list = reverse.extruded ? preparedGeometry.morphsExtruded[reverse.projection] : preparedGeometry.morphs[reverse.projection];
                this.morphTargets.push({ name: morphName, vertices: list });
            }
            this.faces = preparedGeometry.faces;
            this.faceVertexUvs[0] = preparedGeometry.faceVertexUvs;
            this.projection = mainProjector;
        }
    }
}
