'use strict';
import { Scene, Camera, WebGLRenderer, Raycaster, Mesh, Vector2, BufferGeometry, Material } from 'three';
import { CONFIGURATION } from '../common/configuration';
import { PseudoCone } from './base';
import { ConeMeshShader } from './coneMeshShader';
import { updateSumUpCriteria, Cartographic, searchCriterias } from '../common/utils';
import {
    ISumUpCriteria, ILookupAndMaxSpeedAndLine, ICriterias, ILookupTownTransport,
    ILookupTransportPerYear, ILookupLine,
} from '../definitions/project';
import { CountryBoard } from '../country/countryBoard';
import { LineMeshShader } from './lineMeshShaders';
const forbiddenAttributes = ['referential', 'position'];

export class ConeBoard {
    public coneMeshCollection: PseudoCone[] = [];
    public lineCollection: LineMeshShader[] = [];
    private _scene: Scene;
    private _camera: Camera;
    private _raycaster: Raycaster;
    private _highlitedCriterias: ICriterias = {};
    private _selectedMeshs: Mesh[] = [];
    private _scale: number = 1;
    private _show: boolean = true;
    private _withLimits: boolean = true;
    private _countries: CountryBoard;
    private _year: string;
    private _sumUpProperties: ISumUpCriteria = {};
    private _renderer: WebGLRenderer;
    private _opacity: number = 1;

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

    get lookupCriterias(): ISumUpCriteria {
        return this._sumUpProperties;
    }
    get opacity(): number {
        return this._opacity;
    }

    set opacity(value: number) {
        if (value > 0 && value <= 1) {
            this._opacity = value;
            this.coneMeshCollection.forEach(cone => (<Material>cone.material).opacity = value);
        }
    }
    public constructor(scene: Scene, camera: Camera, countries: CountryBoard, renderer: WebGLRenderer) {
        this._scene = scene;
        this._camera = camera;
        this._raycaster = new Raycaster();
        this._countries = countries;
        this._renderer = renderer;
    }

    public add(lookup: ILookupAndMaxSpeedAndLine, distance: number): void {
        this.clean();
        let myConsistentLookup = <ILookupTownTransport>{};
        for (let cityCode in lookup.lookupTownTransport) {
            if (lookup.lookupTownTransport.hasOwnProperty(cityCode) &&
                Object.keys(lookup.lookupTownTransport[cityCode].transports).length > 1) {
                myConsistentLookup[cityCode] = lookup.lookupTownTransport[cityCode];
            }
        }
        // lookup.lookupTownTransport = myConsistentLookup;
        let that = this;
        let bboxes = this._countries.countryMeshCollection.map((country) => country.bbox);
        ConeMeshShader.generateCones(lookup.lookupTownTransport, lookup.maxSpeedPerYear, bboxes).then((cones) => {
            cones.forEach((cone) => {
                updateSumUpCriteria(that._sumUpProperties, cone.otherProperties);
                that.coneMeshCollection.push(cone);
                cone.visible = that._show;
                cone.scale.setScalar(that._scale);
                that._scene.add(cone);
                that._renderer.render(that._scene, that._camera);
            });
        });
        LineMeshShader.generateCones(lookup.lineData).then((lines) => {
            lines.forEach((line) => {
                that.lineCollection.push(line);
                line.visible = that._show;
                line.scale.setScalar(that._scale);
                that._scene.add(line);
                that._renderer.render(that._scene, that._camera);
            });
        });
    }

    public setLayer(transport: string, show: boolean): void {
        this.searchMesh({ transport: { value: transport } }).forEach((mesh) => {
            mesh.visible = show;
        });
    }
    public clean(): void {
        for (let i = this.coneMeshCollection.length - 1; i >= 0; i--) {
            this._scene.remove(this.coneMeshCollection[i]);
            this.coneMeshCollection[i].dispose();
            this.coneMeshCollection.splice(i, 1);
        }
        this._sumUpProperties = {};
    }

    public getMeshByMouse(event: MouseEvent, highLight: boolean = false): PseudoCone {
        let resultat: PseudoCone;
        let mouse = new Vector2();
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;
        this._raycaster.setFromCamera(mouse, this._camera);
        let intersects = this._raycaster.intersectObjects(this.coneMeshCollection);
        if (intersects.length > 0) {
            resultat = <PseudoCone>intersects[0].object;
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
                let geometry = <BufferGeometry>mesh.geometry.clone();
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

    public searchMesh(criterias: ICriterias | Cartographic, path: string = ''): PseudoCone[] {
        let resultat: PseudoCone[];
        if (criterias instanceof Cartographic) {
            resultat = this.coneMeshCollection.filter((cone) => cone.cartographicPosition.distanceApproximee(criterias) < 1e-13);
        } else {
            resultat = searchCriterias(this.coneMeshCollection, criterias, forbiddenAttributes, 'otherProperties.' + path);
        }
        return resultat;
    }

    public showCriterias(criterias: ICriterias, state: boolean): void {
        let realState = state && this._show;
        this.searchMesh(criterias).forEach((cone) => {
            cone.visible = realState;
        });
    }

    private _reHighLight(): void {
        if (this._selectedMeshs.length > 0) {
            let visible = false;
            let temp = this._selectedMeshs[0];
            if (!Array.isArray(temp.material)) {
                visible = temp.material.visible;
            }
            let criterias = this._highlitedCriterias;
            this._highlitedCriterias = undefined;
            this.highLight(criterias, visible);
        }
    }
}
