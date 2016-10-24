namespace shriveling {
    'use strict';

    export class CountryBoard {
        public static highLitedMaterial: THREE.Material =
        new THREE.MeshBasicMaterial({ color: 0xffff00, morphTargets: true, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
        public countryMeshCollection: CountryMesh[] = [];
        private _projection: string;
        private _scene: THREE.Scene;
        private _isReprojecting: boolean = false;
        private _camera: THREE.Camera;
        private _raycaster: THREE.Raycaster;
        private _highlitedMeshName: string;
        private _selectedMeshs: THREE.Mesh[] = [];
        private _scale: number = 1;

        public static extrude(
            meshes: CountryMesh[], value: number | number[] = 70, timing: number = 1000, init?: number,
            easingFunction: { (k: number): number } = TWEEN.Easing.Linear.None): void {
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
                .start();
        }

        public constructor(geoJson: any, mainProjector: string, scene: THREE.Scene, camera: THREE.Camera) {
            if (!mapProjectors.hasOwnProperty(mainProjector)) {
                mainProjector = Object.keys(mapProjectors)[0];
            }
            this._scene = scene;
            this._camera = camera;
            this._raycaster = new THREE.Raycaster();
            this._projection = mainProjector;
            this.add(geoJson);
        }

        public add(geoJson: any): void {
            let collection = CountryMesh.generator(geoJson, this._projection);
            let that = this;
            collection.forEach((mesh) => {
                that.countryMeshCollection.push(mesh);
                that._scene.add(mesh);
            });
            this._projection = this._projection;
        }

        get projection(): string {
            return this._projection;
        }

        set projection(value: string) {
            this.changeProjection(value);
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
                        CountryBoard.extrude(that.countryMeshCollection, extruded, 1000, 0, TWEEN.Easing.Elastic.InOut);
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
            if (intersects.length > 0 && this.countryMeshCollection.indexOf(<CountryMesh>intersects[0].object) > 0) {
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

        public extrudeByName(name: string, value?: number): void {
            this._selectedMeshs.forEach((mesh) => {
                mesh.material.visible = false;
            });
            CountryBoard.extrude(this.getMeshes(name), value);
        }

        public extrudeByArray(tab: CountryMesh[] = this.countryMeshCollection, value?: number): void {
            this._selectedMeshs.forEach((mesh) => {
                mesh.material.visible = false;
            });
            CountryBoard.extrude(tab, value);
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
                    let out = new THREE.Mesh(geometry, CountryBoard.highLitedMaterial);
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
    }
}
