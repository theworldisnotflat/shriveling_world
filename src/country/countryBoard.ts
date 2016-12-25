namespace shriveling {
    'use strict';

    export class CountryBoard {
        public countryMeshCollection: CountryMesh[] = [];
        private _projection: string;
        private _scene: THREE.Scene;
        private _isReprojecting: boolean = false;
        private _camera: THREE.Camera;
        private _raycaster: THREE.Raycaster;
        private _highlitedCriterias: ICriterias = {};
        private _selectedMeshs: THREE.Mesh[] = [];
        private _scale: number = 1;
        private _show: boolean = true;
        private _sumUpProperties: ISumUpCriteria = {};

        public static extrude(
            meshes: CountryMesh[], timing: number, value: number | number[] = 70, init?: number,
            easingFunction: { (k: number): number } = TWEEN.Easing.Linear.None, callBack?: { func: () => void, scope: any }): void {
            let begin = {}, end = {};
            if (typeof value === 'number') {
                value = [value];
            }
            let valueLength = value.length;
            for (let i = 0; i < meshes.length; i++) {
                begin[i] = init !== undefined ? init : meshes[i].extruded;
                end[i] = i < valueLength ? value[i] : value[valueLength - 1];
            }
            new TWEEN.Tween(begin)
                .to(end, timing)
                .easing(easingFunction)
                .onUpdate(() => {
                    for (let i = 0; i < meshes.length; i++) {
                        meshes[i].extruded = begin[i];
                    }
                })
                .onComplete(() => {
                    if (callBack) {
                        callBack.func.call(callBack.scope);
                    }
                })
                .start();
        }

        get projection(): string {
            return this._projection;
        }
        set projection(value: string) {
            this.changeProjection(value);
        }

        get show(): boolean {
            return this._show;
        }
        set show(value: boolean) {
            this.countryMeshCollection.forEach((country) => {
                country.visible = value;
            });
            this._show = value;
        }

        get scale(): number {
            return this._scale;
        }
        set scale(value: number) {
            this._selectedMeshs.forEach((mesh) => {
                mesh.scale.setScalar(value);
            });
            this.countryMeshCollection.forEach((mesh) => {
                mesh.scale.setScalar(value);
            });
            this._scale = value;
        }

        get lookupCriterias(): ISumUpCriteria {
            return this._sumUpProperties;
        }

        public constructor(mainProjector: string, scene: THREE.Scene, camera: THREE.Camera) {
            if (!mapProjectors.hasOwnProperty(mainProjector)) {
                mainProjector = Object.keys(mapProjectors)[0];
            }
            this._scene = scene;
            this._camera = camera;
            this._raycaster = new THREE.Raycaster();
            this._projection = mainProjector;
        }

        public add(geoJson: any): void {
            let collection = CountryMesh.generator(geoJson, this._projection);
            let that = this;
            collection.forEach((mesh) => {
                that.countryMeshCollection.push(mesh);
                that._scene.add(mesh);
                mesh.visible = that._show;
                mesh.scale.setScalar(that._scale);
                updateSumUpCriteria(that._sumUpProperties, mesh.otherProperties);
            });
            this.projection = this._projection;
        }

        public changeProjection(
            projection: string, timing: number = Configuration.TWEEN_TIMING,
            easingFunction: { (k: number): number } = TWEEN.Easing.Linear.None): void {
            if (mapProjectors.hasOwnProperty(projection) && this._isReprojecting === false) {
                this._isReprojecting = true;
                let value = { stage: 0 };
                let that = this;
                new TWEEN.Tween(value)
                    .to({ stage: 100 }, timing)
                    .easing(easingFunction)
                    .onStart(() => {
                        that.countryMeshCollection.forEach((mesh) => {
                            mesh.reProject(projection);
                        });
                        that._selectedMeshs.forEach((mesh) => {
                            mesh.material.visible = false;
                        });
                    })
                    .onUpdate(() => {
                        that.countryMeshCollection.forEach((mesh) => {
                            mesh.reProject(value.stage);
                        });
                    })
                    .onComplete(() => {
                        let extruded: number[] = [];
                        that.countryMeshCollection.forEach((mesh) => {
                            extruded.push(mesh.extruded);
                            mesh.projection = projection;
                        });
                        that._isReprojecting = false;
                        that._projection = projection;
                        CountryBoard.extrude(
                            that.countryMeshCollection, timing, extruded, 0,
                            TWEEN.Easing.Elastic.InOut, { func: that._reHighLight, scope: that });
                    })
                    .start();
            }
        }

        public clean(): void {
            for (let i = this.countryMeshCollection.length - 1; i >= 0; i--) {
                this._scene.remove(this.countryMeshCollection[i]);
                this.countryMeshCollection.splice(i, 1);
            }
            this._selectedMeshs.forEach((mesh) => {
                mesh.visible = false;
            });
            this._sumUpProperties = {};
        }

        public getMeshByMouse(event: MouseEvent, highLight: boolean = false): CountryMesh {
            let resultat: CountryMesh;
            let mouse = new THREE.Vector2();
            mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;
            this._raycaster.setFromCamera(mouse, this._camera);
            let intersects = this._raycaster.intersectObjects(this.countryMeshCollection);
            if (intersects.length > 0) {
                resultat = <CountryMesh>intersects[0].object;
                this.highLight(resultat.otherProperties, highLight);
            } else {
                this._selectedMeshs.forEach((mesh) => {
                    mesh.material.visible = false;
                });
            }
            return resultat;
        }

        public extrude(criterias: ICriterias, value?: number): void {
            this._selectedMeshs.forEach((mesh) => {
                mesh.visible = false;
            });
            let that = this;
            CountryBoard.extrude(
                this.searchMesh(criterias), value, undefined, undefined, undefined, { func: that._reHighLight, scope: that });
        }

        public highLight(criterias: ICriterias, light: boolean): void {
            if (criterias !== this._highlitedCriterias) {
                this._highlitedCriterias = criterias;
                let that = this;
                this._selectedMeshs.forEach((mesh) => {
                    that._scene.remove(mesh);
                });
                this._selectedMeshs = this.searchMesh(criterias).map((mesh) => {
                    let geometry = (<CountryGeometry>mesh.geometry).fuzzyClone();
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

        public searchMesh(criterias: ICriterias | Cartographic, path: string = ''): CountryMesh[] {
            let resultat: CountryMesh[];
            if (criterias instanceof Cartographic) {
                resultat = this.countryMeshCollection.filter((country) => country.isInside(criterias));
            } else {
                resultat = searchCriterias(this.countryMeshCollection, criterias, [], 'otherProperties.' + path);
            }
            return resultat;
        }

        public showCriterias(criterias: ICriterias, state: boolean): void {
            let realState = state && this._show;
            this.searchMesh(criterias).forEach((country) => {
                country.visible = realState;
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
