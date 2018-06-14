'use strict';
import { Scene, Camera, Raycaster, Mesh, Vector2, Material } from 'three';
import { mapProjectors, updateSumUpCriteria, Cartographic, searchCriterias } from '../common/utils';
import { ISumUpCriteria, ICriterias } from '../definitions/project';
import { CONFIGURATION } from '../common/configuration';
import { CountryMeshShader } from './countryMeshShader';
export class CountryBoard {
    public countryMeshCollection: CountryMeshShader[] = [];
    public ready: boolean = false;
    private _scene: Scene;
    private _camera: Camera;
    private _raycaster: Raycaster;
    private _highlitedCriterias: ICriterias = {};
    private _selectedMeshs: Mesh[] = [];
    private _scale: number = 1;
    private _show: boolean = true;
    private _opacity: number = 1;
    private _sumUpProperties: ISumUpCriteria = {};
    private _extruded: number = 1;

    public static extrude(
        meshes: CountryMeshShader[], timing: number, value: number | number[] = 70, init?: number,
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

    get show(): boolean {
        return this._show;
    }
    set show(value: boolean) {
        this.countryMeshCollection.forEach((country) => {
            country.visible = value;
        });
        this._show = value;
    }

    get extruded(): number {
        return this._extruded;
    }
    set extruded(value: number) {
        this.countryMeshCollection.forEach((country) => {
            country.extruded = value;
        });
        this._extruded = value;
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

    get opacity(): number {
        return this._opacity;
    }

    set opacity(value: number) {
        if (value > 0 && value <= 1) {
            this._opacity = value;
            this.countryMeshCollection.forEach(country => (<Material>country.material).opacity = value);
        }
    }

    public constructor(mainProjector: string, scene: Scene, camera: Camera) {
        if (!mapProjectors.hasOwnProperty(mainProjector)) {
            mainProjector = Object.keys(mapProjectors)[0];
        }
        this._scene = scene;
        this._camera = camera;
        this._raycaster = new Raycaster();
    }

    public async add(geoJson: any): Promise<void> {
        this.ready = false;
        this.clean();
        let collection = await CountryMeshShader.generator(geoJson);
        let that = this;
        collection.forEach(mesh => {
            this.countryMeshCollection.push(mesh);
            this._scene.add(mesh);
            mesh.visible = this._show;
            mesh.scale.setScalar(this._scale);
            updateSumUpCriteria(this._sumUpProperties, mesh.otherProperties);
        });
        this.ready = true;
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

    public getMeshByMouse(event: MouseEvent, highLight: boolean = false): CountryMeshShader {
        let resultat: CountryMeshShader;
        let mouse = new Vector2();
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;
        this._raycaster.setFromCamera(mouse, this._camera);
        let intersects = this._raycaster.intersectObjects(this.countryMeshCollection);
        if (intersects.length > 0) {
            resultat = <CountryMeshShader>intersects[0].object;
            this.highLight(resultat.otherProperties, highLight);
        } else {
            this._selectedMeshs.forEach((mesh) => {
                if (!Array.isArray(mesh.material)) {
                    mesh.material.visible = false;
                }
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
                let geometry = mesh.geometry;
                let out = new Mesh(geometry, CONFIGURATION.highLitedMaterial);
                that._scene.add(out);
                out.scale.setScalar(that._scale);
                return out;
            });
        }
        this._selectedMeshs.forEach((mesh) => {
            if (!Array.isArray(mesh.material)) {
                mesh.material.visible = light;
            }
        });
    }

    public searchMesh(criterias: ICriterias | Cartographic, path: string = ''): CountryMeshShader[] {
        let resultat: CountryMeshShader[];
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
            let visible = false;
            let temp = this._selectedMeshs[0].material;
            if (!Array.isArray(temp)) {
                visible = temp.visible;
            }
            let criterias = this._highlitedCriterias;
            this._highlitedCriterias = undefined;
            this.highLight(criterias, visible);
        }
    }
}
