namespace shriveling {
    'use strict';

    export class CountryBoard {
        public countryMeshCollection: CountryMesh[] = [];
        private _projection: string;
        private _scene: THREE.Scene;
        private _isReprojecting: boolean = false;
        private _camera: THREE.Camera;
        private _raycaster: THREE.Raycaster;
        private _highlitedMeshName: string;
        private _selectedMeshs: THREE.Mesh[] = [];
        private _scale: number = 1;
        private _show: boolean = true;

        public static extrude(
            meshes: CountryMesh[], value: number | number[] = 70, timing: number = 1000, init?: number,
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

        public constructor(mainProjector: string, scene: THREE.Scene, camera: THREE.Camera) {
            if (!mapProjectors.hasOwnProperty(mainProjector)) {
                mainProjector = Object.keys(mapProjectors)[0];
            }
            Configuration.prepareConfiguration();
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
            });
            this.projection = this._projection;
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

        public changeProjection(
            projection: string, timing: number = 1000, easingFunction: { (k: number): number } = TWEEN.Easing.Linear.None): void {
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
                            that.countryMeshCollection, extruded, 1000, 0,
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
        }

        public getMeshByMouse(event: MouseEvent, highLight: boolean = false): string {
            let resultat: string;
            let mouse = new THREE.Vector2();
            mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;
            this._raycaster.setFromCamera(mouse, this._camera);
            let intersects = this._raycaster.intersectObjects(this.countryMeshCollection);
            if (intersects.length > 0) {
                resultat = intersects[0].object.name;
                this.highLight(resultat, highLight);
            } else {
                this._selectedMeshs.forEach((mesh) => {
                    mesh.material.visible = false;
                });
            }
            return resultat;
        }

        public getMeshes(name: string): CountryMesh[] {
            return this.countryMeshCollection.filter((mesh) => mesh.name === name);
        }

        public getCountryName(pos: Cartographic): string {
            let resultat: string;
            for (let i = 0; i < this.countryMeshCollection.length && resultat === undefined; i++) {
                let inside = (<CountryGeometry>this.countryMeshCollection[i].geometry).isInside(pos);
                if (inside) {
                    resultat = this.countryMeshCollection[i].name;
                }
            }
            return resultat;
        }

        public extrudeByName(name: string, value?: number): void {
            this._selectedMeshs.forEach((mesh) => {
                mesh.material.visible = false;
            });
            let that = this;
            CountryBoard.extrude(this.getMeshes(name), value, undefined, undefined, undefined, { func: that._reHighLight, scope: that });
        }

        public extrudeByArray(tab: CountryMesh[] = this.countryMeshCollection, value?: number): void {
            this._selectedMeshs.forEach((mesh) => {
                mesh.material.visible = false;
            });
            let that = this;
            CountryBoard.extrude(tab, value, undefined, undefined, undefined, { func: that._reHighLight, scope: that });
        }

        public scale(value: number): void {
            this._selectedMeshs.forEach((mesh) => {
                mesh.scale.setScalar(value);
            });
            this.countryMeshCollection.forEach((mesh) => {
                mesh.scale.setScalar(value);
            });
            this._scale = value;
        }

        public highLight(name: string, light: boolean = true): void {
            if (name !== this._highlitedMeshName) {
                this._highlitedMeshName = name;
                let that = this;
                this._selectedMeshs.forEach((mesh) => {
                    that._scene.remove(mesh);
                });
                this._selectedMeshs = this.getMeshes(name).map((mesh) => {
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

        private _reHighLight(): void {
            if (this._selectedMeshs.length > 0) {
                let visible = this._selectedMeshs[0].material.visible;
                let name = this._highlitedMeshName;
                this._highlitedMeshName = undefined;
                this.highLight(name, visible);
            }
        }
    }
}
