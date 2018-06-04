'use strict';
import { CONFIGURATION } from '../common/configuration';
import {
    MeshBasicMaterial, DoubleSide, TextureLoader, MeshPhongMaterial, Color, Vector2, PerspectiveCamera,
    OrbitControls, Scene, WebGLRenderer, BackSide, CubeGeometry, PointLight, Fog, AmbientLight, Mesh, LineBasicMaterial,
} from 'three';
import { ConeBoard } from '../cone/coneBoard';
import { CountryBoard } from '../country/countryBoard';
import { Merger } from './merger';
import { DragnDrop, mapProjectors } from '../common/utils';
import { configurationObservableEvt, IMergerState, ISumUpCriteria, ILookupAndMaxSpeedAndLine, ICriterias } from '../definitions/project';
import { PseudoCone } from '../cone/base';
import { CountryMesh } from '../country/countryMesh';
import * as dat from 'dat.gui';
declare var Stats: any;

function prepareConfiguration(): void {
    if (CONFIGURATION.COUNTRY_MATERIAL === undefined) {
        CONFIGURATION.highLitedMaterial = new MeshBasicMaterial(
            { color: 0xffff00, morphTargets: true, transparent: true, opacity: 0.5, side: DoubleSide });
        let loader = new TextureLoader();

        let earthMaterial = new MeshPhongMaterial({
            morphTargets: true, opacity: 0.5, depthTest: true, depthWrite: true, transparent: false,
        });
        earthMaterial.map = loader.load(CONFIGURATION.COUNTRY_TEXTURES.map);
        earthMaterial.specularMap = loader.load(CONFIGURATION.COUNTRY_TEXTURES.specularMap);
        earthMaterial.specular = new Color(0x262626);
        earthMaterial.bumpMap = loader.load(CONFIGURATION.COUNTRY_TEXTURES.bumpMap);
        earthMaterial.bumpScale = 0.15;
        earthMaterial.normalMap = loader.load(CONFIGURATION.COUNTRY_TEXTURES.normalMap);
        earthMaterial.normalScale = new Vector2(0.5, 0.7);
        earthMaterial.side = DoubleSide;
        CONFIGURATION.COUNTRY_MATERIAL = earthMaterial;
        CONFIGURATION.BASIC_CONE_MATERIAL = new MeshPhongMaterial({
            transparent: true,
            opacity: 0.5,
            color: 0xff3333,
        });
        CONFIGURATION.BASIC_CONE_MATERIAL.side = DoubleSide;
    }
}

let _lookupTransportColor: { [transportName: string]: { color: string, opacity: number } } = {};

export default class BigBoard {
    public static configuration: any = CONFIGURATION;
    public projectionNames: string[];
    private _cones: ConeBoard;
    private _countries: CountryBoard;
    private _container: HTMLDivElement;
    private _stats: any;
    private _controls: OrbitControls;

    private _camera: PerspectiveCamera;
    private _scene: Scene;
    private _renderer: WebGLRenderer;
    private _windowHalfX: number = window.innerWidth / 2;
    private _windowHalfY: number = window.innerHeight / 2;
    private _projectionName: string;
    private _merger: Merger;

    constructor() {
        this.updateConfiguration();
        this._projectionName = this.projectionNames[0];
        this._merger = new Merger();
        this._init();
        this._countries = new CountryBoard(this._projectionName, this._scene, this._camera);
        this._countries.show = false;
        this._cones = new ConeBoard(this._projectionName, this._scene, this._camera, this._countries, this._renderer);
        CONFIGURATION.year = '2010';

        let that = this;
        const gui = new dat.GUI();
        let conf = {
            coneStep: CONFIGURATION.coneStep * CONFIGURATION.rad2deg,
            year: parseInt(CONFIGURATION.year, 10),
            projection: { aucun: 0, equirectangulaire: 1, Mercator: 2 },
            'projection initiale': 0,
            'projection finale': 0,
            'transition projection': 0,
            'nombre de points': 50,
            // initialement:2
            'type de transport': '',
            'couleur des cônes': '#ebdede',
            // initialement: '#ff0000'   ensuite #ebdede = presque blanc
            'transparence des cônes': 1,
            'couleur des lignes': '#0000ff',
            'transparence des lignes': .3,
            // initialement 1
        };

        let generalFolder = gui.addFolder('Généralités');
        let annees = generalFolder.add(conf, 'year', 1930, 1990).step(1);
        annees.onChange(v => CONFIGURATION.year = v);
        generalFolder.add(conf, 'projection initiale', conf.projection).onFinishChange(v => CONFIGURATION.projectionInit = v);
        generalFolder.add(conf, 'projection finale', conf.projection).onFinishChange(v => CONFIGURATION.projectionEnd = v);
        generalFolder.add(conf, 'transition projection', 0, 100).step(1).onChange(v => CONFIGURATION.percentProjection = v);

        let coneFolder = gui.addFolder('Cones');
        coneFolder.add(conf, 'coneStep', 1, 360).step(1).
            onChange(value => CONFIGURATION.coneStep = value * CONFIGURATION.deg2rad);
        coneFolder.add(this, 'withLimits');
        let coneSelectTransport = coneFolder.add(conf, 'type de transport', this._merger.transportNames);
        coneSelectTransport.onChange((v) => {
            if (!_lookupTransportColor.hasOwnProperty(v)) {
                _lookupTransportColor[v] = { color: '#ff0000', opacity: 1 };
            }
            coneColor.setValue(_lookupTransportColor[v].color).updateDisplay();
            coneOpacity.setValue(_lookupTransportColor[v].opacity).updateDisplay();
        });
        let coneColor = coneFolder.addColor(conf, 'couleur des cônes');
        coneColor.onChange((v) => {
            let selectedTransport = <string>coneSelectTransport.getValue();
            let opacity = <number>coneOpacity.getValue();
            let color = new Color(v);
            that._cones.coneMeshCollection.filter((cone) => selectedTransport === cone.transportName)
                .forEach((cone) => {
                    let material = (<MeshPhongMaterial>cone.material);
                    material.color.r = color.r;
                    material.color.g = color.g;
                    material.color.b = color.b;
                    material.opacity = opacity;
                });
        });
        let coneOpacity = coneFolder.add(conf, 'transparence des cônes', 0, 1).step(0.01);
        coneOpacity.onChange((v) => {
            let selectedTransport = <string>coneSelectTransport.getValue();
            let opacity = v;
            let color = new Color(coneOpacity.getValue());
            that._cones.coneMeshCollection.filter((cone) => selectedTransport === cone.transportName)
                .forEach((cone) => {
                    let material = (<MeshPhongMaterial>cone.material);
                    material.color.r = color.r;
                    material.color.g = color.g;
                    material.color.b = color.b;
                    material.opacity = opacity;
                });
        });
        let lineFolder = gui.addFolder('Lignes');
        lineFolder.add(conf, 'nombre de points', 1, 200).step(1).onChange(v => CONFIGURATION.pointsPerLine = v);
        let lineColor = lineFolder.addColor(conf, 'couleur des lignes');
        lineColor.onChange((v) => {
            let opacity = <number>lineOpacity.getValue();
            let color = new Color(v);
            that._cones.lineCollection.forEach((line) => {
                let material = (<LineBasicMaterial>line.material);
                material.color.r = color.r;
                material.color.g = color.g;
                material.color.b = color.b;
                material.opacity = opacity;
            });
        });
        let lineOpacity = lineFolder.add(conf, 'transparence des lignes', 0, 1).step(0.01);
        lineOpacity.onChange((v) => {
            let opacity = v;
            let color = new Color(lineColor.getValue());
            that._cones.lineCollection.forEach((line) => {
                let material = (<LineBasicMaterial>line.material);
                material.color.r = color.r;
                material.color.g = color.g;
                material.color.b = color.b;
                material.opacity = opacity;
            });
        });
        // pays /mise en exergue avec listen?
        let countryFolder = gui.addFolder('pays');
        countryFolder.add(this._countries, 'show');

        DragnDrop(
            this._container, (text, name) => {
                if (name.toLowerCase().endsWith('.csv')) {
                    that._merger.add(text);
                    if (that.state === 'ready') {
                        that._merger.merge();
                    }
                } else if (name.toLowerCase().endsWith('.geojson')) {
                    that._countries.add(JSON.parse(text));
                }
                if (that._merger.state === 'complete' && that._countries.countryMeshCollection.length > 0) {
                    _lookupTransportColor = {};
                    annees.min(that._merger.minYear).max(that._merger.maxYear).updateDisplay();
                    coneSelectTransport.options(that._merger.transportNames).setValue(that._merger.transportNames[0]).updateDisplay();
                    that._cones.add(that._merger.datas, CONFIGURATION.extrudedHeight);
                }
            },
            this);
        // this._container.addEventListener('dblclick', (evt) => {
        //     if (countryBoard) {
        //         let name = countryBoard.getMeshByMouse(evt, true);
        //         console.log(name);
        //     }
        // });
        this._animate();
    }

    get scaleCountries(): number {
        return this._countries.scale;
    }
    set scaleCountries(value: number) {
        this._countries.scale = value;
    }

    get scaleCones(): number {
        return this._cones.scale;
    }
    set scaleCones(value: number) {
        this._cones.scale = value;
    }

    get showCountries(): boolean {
        return this._countries.show;
    }
    set showCountries(value: boolean) {
        this._countries.show = value;
    }

    get showCones(): boolean {
        return this._cones.show;
    }
    set showCones(value: boolean) {
        this._cones.show = value;
    }

    get lookupCountries(): ISumUpCriteria {
        return this._countries.lookupCriterias;
    }

    get lookupCones(): ISumUpCriteria {
        return this._cones.lookupCriterias;
    }

    get withLimits(): boolean {
        return this._cones.withLimits;
    }
    set withLimits(value: boolean) {
        this._cones.withLimits = value;
    }

    get state(): IMergerState {
        return this._merger.state;
    }

    public updateConfiguration(): void {
        this.projectionNames = Object.keys(mapProjectors);
        prepareConfiguration();
    }

    public cleanCountries(): void {
        this._countries.clean();
        //        this._cones.regenerateLimits();
    }

    public addCountries(geoJson: any): void {
        this._countries.add(geoJson);
        //      this._cones.regenerateLimits();
    }

    public cleanCones(): void {
        this._cones.clean();
    }

    public addCones(lookup: ILookupAndMaxSpeedAndLine): void {
        this._cones.add(lookup, CONFIGURATION.extrudedHeight);
    }

    public getCountryByMouse(event: MouseEvent, highLight: boolean = false): CountryMesh {
        return this._countries.getMeshByMouse(event, highLight);
    }

    public getConeByMouse(event: MouseEvent, highLight: boolean = false): PseudoCone {
        return this._cones.getMeshByMouse(event, highLight);
    }

    public highLightCountries(criterias: ICriterias, light: boolean = true): void {
        this._countries.highLight(criterias, light);
    }

    public highLightCones(criterias: ICriterias, light: boolean = true): void {
        this._cones.highLight(criterias, light);
    }

    public setLimits(criterias: ICriterias, limit: boolean): void {
        this._cones.setLimits(criterias, limit);
    }

    public showCountriesCriterias(criterias: ICriterias, state: boolean): void {
        this._countries.showCriterias(criterias, state);
    }

    public showConesCriterias(criterias: ICriterias, state: boolean): void {
        this._cones.showCriterias(criterias, state);
    }

    public getCountries(criterias: ICriterias): CountryMesh[] {
        let resultat: CountryMesh[] = [];
        if (this._countries.show === true) {
            resultat = this._countries.searchMesh(criterias);
        }
        return resultat;
    }

    public getCones(criterias: ICriterias): PseudoCone[] {
        let resultat: PseudoCone[] = [];
        if (this._cones.show === true) {
            resultat = this._cones.searchMesh(criterias);
        }
        return resultat;
    }

    public extrude(criterias: ICriterias, value?: number): void {
        this._countries.extrude(criterias, value);
    }

    private _init(): void {
        let that = this;
        this._container = document.createElement('div');
        document.body.appendChild(this._container);
        this._stats = new Stats();
        this._stats.domElement.style.position = 'absolute';
        this._stats.domElement.style.bottom = '0px';
        this._stats.domElement.style.zIndex = 100;
        this._container.appendChild(this._stats.domElement);
        this._camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 15000);
        this._camera.position.set(0, 0, 500);

        this._scene = new Scene();
        this._scene.add(this._camera);
        this._camera.lookAt(this._scene.position);
        this._scene.fog = new Fog(0x000000, 1, 15000);

        let light = new PointLight(0xffffff);
        light.position.set(1000, 1000, 1000);
        this._scene.add(light);

        let ambient = new AmbientLight(0xffffff);
        this._scene.add(ambient);

        this._renderer = new WebGLRenderer({ antialias: true });
        this._renderer.setClearColor(0x222222);
        this._renderer.setPixelRatio(window.devicePixelRatio);
        this._renderer.setSize(window.innerWidth, window.innerHeight);
        this._renderer.sortObjects = false;
        this._container.appendChild(this._renderer.domElement);
        this._controls = new OrbitControls(this._camera, this._renderer.domElement);

        window.addEventListener(
            'resize', () => {
                that._windowHalfX = window.innerWidth / 2;
                that._windowHalfY = window.innerHeight / 2;

                that._camera.aspect = window.innerWidth / window.innerHeight;
                that._camera.updateProjectionMatrix();

                that._renderer.setSize(window.innerWidth, window.innerHeight);
            },
            false);

        // skybox
        let loader = new TextureLoader();
        let materialArray = CONFIGURATION.SKYBOX_URLS.map((url) =>
            new MeshBasicMaterial({
                map: loader.load(url),
                side: BackSide,
            }));

        let skyGeometry = new CubeGeometry(10000, 10000, 10000);
        let skybox = new Mesh(skyGeometry, <any>materialArray);
        this._scene.add(skybox);
    }

    private _animate(): void {
        let that = this;
        let scene = this._scene;
        let camera = this._camera;
        requestAnimationFrame(() => that._animate());
        that._renderer.render(scene, camera);
        that._stats.update();
        that._controls.update();
        TWEEN.update();
        CONFIGURATION.tick();
    }

}
