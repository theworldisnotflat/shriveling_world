namespace shriveling {
    'use strict';

    const ZERO_BUFFER_GEOMETRY = new THREE.BufferGeometry();

    interface ISimpleItemBufferGeometry {
        [projection: string]: {
            withLimits: THREE.BufferGeometry;
            withoutLimits: THREE.BufferGeometry;
        };
    }

    interface IBufferGeometry {
        [year: string]: ISimpleItemBufferGeometry;
    }

    export class ConeMesh extends THREE.Mesh {

        public otherProperties: any;
        private _year: string;
        private _projection: string;
        private _bufferGeometries: IBufferGeometry;
        private _withLimits: boolean = true;
        private _position: Cartographic;

        public static generator(
            lookupTown: ILookupTownPseudoGeometryPremises, yearConsigned: string, projectionConsigned: string): ConeMesh[] {
            let position = lookupTown.position;
            let othersProperties = lookupTown.otherProperties;
            let resultat: ConeMesh[] = [];
            for (let transport in lookupTown.transports) {
                if (lookupTown.transports.hasOwnProperty(transport)) {
                    let coneMeshBuffers: IBufferGeometry = {};
                    let geometryLookupPremises = lookupTown.transports[transport];
                    let properties = Object.assign({ transport: transport }, othersProperties);
                    for (let year in geometryLookupPremises) {
                        if (geometryLookupPremises.hasOwnProperty(year)) {
                            coneMeshBuffers[year] = {};
                            let geometryWithLimits = geometryLookupPremises[year].withLimits;
                            let geometryWithoutLimits = geometryLookupPremises[year].withoutLimits;
                            let uvArrayWith = new Float32Array(geometryWithLimits.uv);
                            let indexArrayWith = new Uint32Array(geometryWithLimits.index);
                            let uvArrayWithout = new Float32Array(geometryWithoutLimits.uv);
                            let indexArrayWithout = new Uint32Array(geometryWithoutLimits.index);

                            for (let projection in geometryWithLimits.vertices) {
                                if (geometryWithLimits.vertices.hasOwnProperty(projection) &&
                                    geometryWithoutLimits.vertices.hasOwnProperty(projection)) {
                                    let verticesBufferWith = new Float32Array(geometryWithLimits.vertices[projection]);
                                    let verticesBufferWithout = new Float32Array(geometryWithoutLimits.vertices[projection]);

                                    let geometryWith = new THREE.BufferGeometry();
                                    geometryWith.addAttribute('position', new THREE.BufferAttribute(verticesBufferWith, 3));
                                    geometryWith.addAttribute('uv', new THREE.BufferAttribute(uvArrayWith, 2));
                                    geometryWith.setIndex(new THREE.BufferAttribute(indexArrayWith, 1));

                                    let geometryWithout = new THREE.BufferGeometry();
                                    geometryWithout.addAttribute('position', new THREE.BufferAttribute(verticesBufferWithout, 3));
                                    geometryWithout.addAttribute('uv', new THREE.BufferAttribute(uvArrayWithout, 2));
                                    geometryWithout.setIndex(new THREE.BufferAttribute(indexArrayWithout, 1));

                                    coneMeshBuffers[year][projection] = {
                                        withLimits: geometryWith,
                                        withoutLimits: geometryWithout,
                                    };
                                }
                            }
                        }
                    }
                    resultat.push(new ConeMesh(
                        coneMeshBuffers, position, yearConsigned, projectionConsigned, true, properties));
                }
            }
            return resultat;
        }

        get projection(): string {
            return this._projection;
        }
        set projection(value: string) {
            this._projection = value;
            this._update();
        }

        get year(): string {
            return this._year;
        }
        set year(value: string) {
            this._year = value;
            this._update();
        }

        get withLimits(): boolean {
            return this._withLimits;
        }
        set withLimits(value: boolean) {
            this._withLimits = value;
            this._update();
        }

        get cartographicPosition(): Cartographic {
            return this._position;
        }

        private constructor(
            lookupBuffer: IBufferGeometry, position: Cartographic, year: string,
            projectionName: string, withLimit: boolean, others: any = {}) {
            super(ZERO_BUFFER_GEOMETRY, Configuration.BASIC_CONE_MATERIAL);
            this._year = year;
            this._projection = projectionName;
            this._withLimits = withLimit;
            this.otherProperties = others;
            this._bufferGeometries = lookupBuffer;
            this._update();
            this.frustumCulled = false;
        }

        private _update(): void {
            let selectedGeometry = ZERO_BUFFER_GEOMETRY;
            if (this._bufferGeometries.hasOwnProperty(this._year)) {
                let datedData = this._bufferGeometries[this._year];
                if (datedData.hasOwnProperty(this._projection)) {
                    selectedGeometry
                        = this._withLimits === true ? datedData[this._projection].withLimits : datedData[this._projection].withoutLimits;
                }
            }
            this.geometry = selectedGeometry;
        }

    }
}
