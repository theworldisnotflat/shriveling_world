namespace shriveling {
    'use strict';

    const forbiddenAttributes = ['referential', 'layers', 'position', 'transports'];

    export class ConeBoard {
        public coneMeshCollection: ConeMesh[] = [];
        private _projection: string;
        private _scene: THREE.Scene;
        private _camera: THREE.Camera;
        private _raycaster: THREE.Raycaster;
        private _highlitedCriterias: ICriterias = {};
        private _selectedMeshs: THREE.Mesh[] = [];
        private _scale: number = 1;
        private _show: boolean = true;
        private _withLimits: boolean = true;
        private _countries: CountryBoard;
        private _year: string;
        private _sumUpProperties: ISumUpCriteria = {};

        get projection(): string {
            return this._projection;
        }
        set projection(value: string) {
            this.coneMeshCollection.forEach((mesh) => {
                mesh.projection = value;
            });
            this._projection = value;
        }

        get show(): boolean {
            return this._show;
        }
        set show(value: boolean) {
            this.coneMeshCollection.forEach((country) => {
                country.visible = value;
            });
            this._show = value;
        }

        get withLimits(): boolean {
            return this._withLimits;
        }
        set withLimits(value: boolean) {
            this.coneMeshCollection.forEach((country) => {
                country.withLimits = value;
            });
            this._withLimits = value;
        }

        get scale(): number {
            return this._scale;
        }
        set scale(value: number) {
            this._selectedMeshs.forEach((mesh) => {
                mesh.scale.setScalar(value);
            });
            this.coneMeshCollection.forEach((mesh) => {
                mesh.scale.setScalar(value);
            });
            this._scale = value;
        }

        get year(): string {
            return this._year;
        }
        set year(value: string) {
            this.coneMeshCollection.forEach((cone) => {
                cone.year = value;
            });
            this._year = value;
        }

        get lookupCriterias(): ISumUpCriteria {
            return this._sumUpProperties;
        }

        public constructor(mainProjector: string, scene: THREE.Scene, camera: THREE.Camera, countries: CountryBoard) {
            if (!mapProjectors.hasOwnProperty(mainProjector)) {
                mainProjector = Object.keys(mapProjectors)[0];
            }
            this._scene = scene;
            this._camera = camera;
            this._raycaster = new THREE.Raycaster();
            this._projection = mainProjector;
            this._countries = countries;
        }

        public add(lookup: IlookupTownTransport, distance: number): void {
            for (let cityCode in lookup) {
                if (lookup.hasOwnProperty(cityCode)) {
                    let commonOthersProperties = {};
                    let townTransport = lookup[cityCode];
                    let referential = townTransport.referential;
                    let transports = townTransport.transports;
                    let criterias = { cityCode: cityCode };

                    for (let attribute in townTransport) {
                        if (townTransport.hasOwnProperty(attribute) && forbiddenAttributes.indexOf(attribute) === -1) {
                            commonOthersProperties[attribute] = townTransport[attribute];
                        }
                    }

                    for (let transport in transports) {
                        if (transports.hasOwnProperty(transport)) {
                            criterias['transport'] = transport;
                            let othersProperties = {};
                            for (let att in commonOthersProperties) {
                                if (commonOthersProperties.hasOwnProperty(att)) {
                                    othersProperties[att] = commonOthersProperties[att];
                                }
                            }
                            othersProperties['transport'] = transport;
                            let cones = this.searchMesh(referential.cartoRef);
                            cones = searchCriterias(cones, { transport: { value: transport } }, forbiddenAttributes, 'otherProperties');
                            updateSumUpCriteria(this._sumUpProperties, othersProperties);
                            if (cones.length > 0) {
                                let cone = cones[0];
                                cone.update(distance, transports[transport]);
                                cone.otherProperties = othersProperties;
                            } else {
                                let boundaryGeometries = this._countries.searchMesh(referential.cartoRef)
                                    .map((mesh) => <CountryGeometry>mesh.geometry);
                                let cone = new ConeMesh(
                                    referential, transports[transport], boundaryGeometries, this._projection, distance, this._withLimits);
                                cone.otherProperties = othersProperties;
                                this.coneMeshCollection.push(cone);
                                cone.visible = this._show;
                                cone.scale.setScalar(this._scale);
                                if (!townTransport.hasOwnProperty('layers')) {
                                    townTransport.layers = {};
                                }
                                townTransport.layers[transport] = cone;
                                this._scene.add(cone);
                            }
                        }
                    }
                }
            }
        }

        public setLayer(transport: string, show: boolean): void {
            this.searchMesh({ transport: { value: transport } }).forEach((mesh) => {
                mesh.visible = show;
            });
        }
        public clean(): void {
            for (let i = this.coneMeshCollection.length - 1; i >= 0; i--) {
                this._scene.remove(this.coneMeshCollection[i]);
                this.coneMeshCollection.splice(i, 1);
            }
            this._sumUpProperties = {};
        }

        public getMeshByMouse(event: MouseEvent, highLight: boolean = false): ConeMesh {
            let resultat: ConeMesh;
            let mouse = new THREE.Vector2();
            mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;
            this._raycaster.setFromCamera(mouse, this._camera);
            let intersects = this._raycaster.intersectObjects(this.coneMeshCollection);
            if (intersects.length > 0) {
                resultat = <ConeMesh>intersects[0].object;
                this.highLight(resultat.otherProperties, highLight);
            } else {
                this._selectedMeshs.forEach((mesh) => {
                    mesh.material.visible = false;
                });
            }
            return resultat;
        }

        public setLimits(criterias: ICriterias, limit: boolean): void {
            this.searchMesh(criterias).forEach((country) => {
                country.withLimits = limit;
            });
        }

        public highLight(criterias: ICriterias, light: boolean): void {
            if (criterias !== this._highlitedCriterias) {
                this._highlitedCriterias = criterias;
                let that = this;
                this._selectedMeshs.forEach((mesh) => {
                    that._scene.remove(mesh);
                });
                this._selectedMeshs = this.searchMesh(criterias).map((mesh) => {
                    let geometry = (<ConeGeometry>mesh.geometry).fuzzyClone();
                    let out = new THREE.Mesh(geometry, Configuration.highLitedMaterial);
                    out.updateMorphTargets();
                    for (let i = 0; i < (<any>mesh).morphTargetInfluences.length; i++) {
                        (<any>out).morphTargetInfluences[i] = (<any>mesh).morphTargetInfluences[i];
                    }
                    that._scene.add(out);
                    out.scale.setScalar(that._scale);
                    return out;
                });
            }
            this._selectedMeshs.forEach((mesh) => {
                mesh.material.visible = light;
            });
        }

        public searchMesh(criterias: ICriterias | Cartographic): ConeMesh[] {
            let resultat: ConeMesh[];
            if (criterias instanceof Cartographic) {
                resultat = this.coneMeshCollection.filter((cone) => cone.cartographicPosition.distanceApproximee(criterias) < 1e-13);
            } else {
                resultat = searchCriterias(this.coneMeshCollection, criterias, forbiddenAttributes, 'otherProperties');
            }
            return resultat;
        }

        public showCriterias(criterias: ICriterias, state: boolean): void {
            let realState = state && this._show;
            this.searchMesh(criterias).forEach((cone) => {
                cone.visible = realState;
            });
        }

        public regenerateLimits(): void {
            let that = this;
            this.coneMeshCollection.forEach((cone) => {
                let boundaryGeometries = this._countries.searchMesh(cone.cartographicPosition)
                    .map((mesh) => <CountryGeometry>mesh.geometry);
                cone.regenerateLimits(boundaryGeometries);
            });
        }

        private _reHighLight(): void {
            if (this._selectedMeshs.length > 0) {
                let visible = this._selectedMeshs[0].material.visible;
                let criterias = this._highlitedCriterias;
                this._highlitedCriterias = undefined;
                this.highLight(criterias, visible);
            }
        }
    }
}
