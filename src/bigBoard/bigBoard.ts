'use strict';
import { CONFIGURATION } from '../common/configuration';
import {
    MeshBasicMaterial, DoubleSide, TextureLoader, MeshPhongMaterial, Color, Vector2, PerspectiveCamera, MeshStandardMaterial,
    OrbitControls, Scene, WebGLRenderer, BackSide, CubeGeometry, PointLight, Fog, AmbientLight, Mesh, LineBasicMaterial,
    SphereBufferGeometry, PCFSoftShadowMap, PointLightHelper,
} from 'three';
import { ConeBoard } from '../cone/coneBoard';
import { CountryBoard } from '../country/countryBoard';
import { Merger } from './merger';
import { DragnDrop } from '../common/utils';
import {
    configurationObservableEvt, IMergerState, ISumUpCriteria, ILookupAndMaxSpeedAndLine, ICriterias,
    IListFile,
} from '../definitions/project';
import { PseudoCone } from '../cone/base';
import { CountryMeshShader } from '../country/countryMeshShader';
import * as dat from 'dat.gui';
declare var Stats: any;

function prepareConfiguration(): void {
    if (CONFIGURATION.COUNTRY_MATERIAL === undefined) {
        CONFIGURATION.highLitedMaterial = new MeshBasicMaterial(
            { color: 0xffff00, transparent: true, opacity: 0.5, side: DoubleSide });
        let earthMaterial = new MeshBasicMaterial({
            opacity: 0.8, depthTest: true, depthWrite: true, side: DoubleSide, transparent: true,
        });
        earthMaterial.map = new TextureLoader().load(CONFIGURATION.COUNTRY_TEXTURES.map);
        earthMaterial.specularMap = new TextureLoader().load(CONFIGURATION.COUNTRY_TEXTURES.specularMap);
        // earthMaterial.bumpMap = new TextureLoader().load(CONFIGURATION.COUNTRY_TEXTURES.bumpMap);
        // earthMaterial.normalMap = new TextureLoader().load(CONFIGURATION.COUNTRY_TEXTURES.normalMap);
        CONFIGURATION.COUNTRY_MATERIAL = earthMaterial;
        CONFIGURATION.BASIC_CONE_MATERIAL = new MeshPhongMaterial({
            transparent: true,
            opacity: 0.8,
            color: 0xebdede,
            side: DoubleSide,
            // shininess: 0,
            // specularMap: 0,
            // roughness: 0,
            // metalness: 0.5,
        });
        (<MeshPhongMaterial>CONFIGURATION.BASIC_CONE_MATERIAL).map = new TextureLoader().load(CONFIGURATION.CONE_TEXTURE);
        CONFIGURATION.BASIC_LINE_MATERIAL = new LineBasicMaterial({
            color: 0x1000ff, linewidth: .5, side: DoubleSide, transparent: true, opacity: 0.3,
        });
    }
}

let _lookupTransportColor: { [transportName: string]: { color: string, opacity: number } } = {};
let _filesData: IListFile[] = [];
let _light = new PointLight(0xffffff, 5); // (0xffffff, 5, 1000, 2);
let _lightMesh = new Mesh(new SphereBufferGeometry(5, 16, 8), new MeshBasicMaterial({ color: 0xffffff }));
_light.castShadow = true;
_light.shadow.mapSize.width = 512;  // default
_light.shadow.mapSize.height = 512; // default
_light.shadow.camera.near = 0.5;       // default
_light.shadow.camera.far = 500;    // default
// _light.add(_lightMesh);

export default class BigBoard {
    public static configuration: any = CONFIGURATION;
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
    private _merger: Merger;

    constructor() {
        this.updateConfiguration();
        this._merger = new Merger();
        this._init();
        this._countries = new CountryBoard(this._scene, this._camera);
        this._countries.show = true;
        this._cones = new ConeBoard(this._scene, this._camera, this._countries, this._renderer);
        CONFIGURATION.year = '2010';
        this.initInteraction();
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
        prepareConfiguration();
    }

    public cleanCountries(): void {
        this._countries.clean();
    }

    public addCountries(geoJson: any): void {
        this._countries.add(geoJson);
    }

    public cleanCones(): void {
        this._cones.clean();
    }

    public addCones(lookup: ILookupAndMaxSpeedAndLine): void {
        this._cones.add(lookup, CONFIGURATION.extrudedHeight);
    }

    public getCountryByMouse(event: MouseEvent, highLight: boolean = false): CountryMeshShader {
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

    public getCountries(criterias: ICriterias): CountryMeshShader[] {
        let resultat: CountryMeshShader[] = [];
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

        _light.position.set(50, 50, 50);
        this._scene.add(_light);
        let helper = new PointLightHelper(_light);
        this._scene.add(helper);

        let ambient = new AmbientLight(0xffffff);
        this._scene.add(ambient);

        this._renderer = new WebGLRenderer({ antialias: true });
        this._renderer.shadowMap.enabled = true;
        this._renderer.shadowMap.type = PCFSoftShadowMap;

        this._renderer.setClearColor(0xffffff);
        this._renderer.setPixelRatio(window.devicePixelRatio);
        this._renderer.setSize(window.innerWidth, window.innerHeight);
        this._renderer.sortObjects = false;
        this._container.appendChild(this._renderer.domElement);
        this._controls = new OrbitControls(this._camera, this._renderer.domElement);

        window.addEventListener(
            'resize', () => {
                this._windowHalfX = window.innerWidth / 2;
                this._windowHalfY = window.innerHeight / 2;

                this._camera.aspect = window.innerWidth / window.innerHeight;
                this._camera.updateProjectionMatrix();

                this._renderer.setSize(window.innerWidth, window.innerHeight);
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
        // this._scene.add(skybox);
    }

    private _animate(): void {
        let scene = this._scene;
        let camera = this._camera;
        requestAnimationFrame(() => this._animate());
        this._renderer.render(scene, camera);
        this._stats.update();
        this._controls.update();
        TWEEN.update();
        CONFIGURATION.tick();
    }

    private initInteraction(): void {
        const gui = new dat.GUI();
        let conf = {
            coneStep: CONFIGURATION.coneStep * CONFIGURATION.rad2deg,
            year: parseInt(<string>CONFIGURATION.year, 10),
            projection: { aucun: 0, equirectangulaire: 1, Mercator: 2, Winkel: 3, Eckert: 4 },
            'type de transport': '',
            'couleur des cônes': '#' + (<any>CONFIGURATION.BASIC_CONE_MATERIAL).color.getHex().toString(16),
            'transparence des cônes': CONFIGURATION.BASIC_CONE_MATERIAL.opacity,
            'couleur des lignes': '#' + CONFIGURATION.BASIC_LINE_MATERIAL.color.getHex().toString(16),
            'transparence des lignes': CONFIGURATION.BASIC_LINE_MATERIAL.opacity,
            'couleur lumière': '#' + _light.color.getHex().toString(16),
            'longitude': CONFIGURATION.referenceEquiRectangular.longitude,
            'latitude': CONFIGURATION.referenceEquiRectangular.latitude,
            'hauteur': CONFIGURATION.referenceEquiRectangular.height,
        };

        let that = this;
        // lumière
        let lightFolder = gui.addFolder('lumière');
        lightFolder.addColor(conf, 'couleur lumière').onChange(v => {
            let color = parseInt(v.replace('#', ''), 16);
            _light.color.setHex(color);
            (<MeshBasicMaterial>_lightMesh.material).color.setHex(color);
        });
        lightFolder.add(_light.position, 'x', -1000, 1000).step(1);
        lightFolder.add(_light.position, 'y', -1000, 1000).step(1);
        lightFolder.add(_light.position, 'z', -1000, 1000).step(1);
        lightFolder.add(_light.shadow.mapSize, 'width', 0, 1000).step(1);
        lightFolder.add(_light.shadow.mapSize, 'height', 0, 1000).step(1);
        lightFolder.add(_light.shadow.camera, 'near', 0, 1000).step(0.5);
        lightFolder.add(_light.shadow.camera, 'far', 0, 1000).step(1);

        // généralités
        let generalFolder = gui.addFolder('Généralités');
        let projectionFolder = generalFolder.addFolder('projection');
        let referenceFolder = projectionFolder.addFolder('projection');
        const radius = CONFIGURATION.earthRadiusMeters;
        function changeReference(): void {
            CONFIGURATION.referenceEquiRectangular = {
                longitude: refLong.getValue() * CONFIGURATION.deg2rad,
                latitude: refLat.getValue() * CONFIGURATION.deg2rad,
                height: refHeight.getValue(),
            };
        }
        let refLong = referenceFolder.add(conf, 'longitude', -180, 180).step(0.01);
        refLong.onChange(changeReference);
        let refLat = referenceFolder.add(conf, 'latitude', -89.99, 89.99).step(0.01);
        refLat.onChange(changeReference);
        let refHeight = referenceFolder.add(conf, 'hauteur', -radius + 10, radius + 10).step(1000);
        refHeight.onChange(changeReference);
        projectionFolder.add(CONFIGURATION, 'projectionInit', conf.projection).name('projection initiale');
        projectionFolder.add(CONFIGURATION, 'projectionEnd', conf.projection).name('projection finale');
        projectionFolder.add(CONFIGURATION, 'percentProjection', 0, 100).step(1).name('transition projection');
        let annees = generalFolder.add(conf, 'year', 1930, 1990).step(1);
        annees.onChange(v => CONFIGURATION.year = v);

        // cônes
        let coneFolder = gui.addFolder('Cones');
        function colorListener(): void {
            let selectedTransport = <string>coneSelectTransport.getValue();
            let opacity = <number>coneOpacity.getValue();
            let color = parseInt(coneColor.getValue().replace('#', ''), 16);
            that._cones.coneMeshCollection.filter((cone) => selectedTransport === cone.transportName)
                .forEach((cone) => {
                    let material = (<MeshPhongMaterial>cone.material);
                    material.color.setHex(color);
                    material.opacity = opacity;
                });
        }
        coneFolder.add(conf, 'coneStep', 1, 360).step(1).
            onChange(value => CONFIGURATION.coneStep = value * CONFIGURATION.deg2rad);
        coneFolder.add(this, 'withLimits');
        coneFolder.add(this._cones, 'opacity', 0, 1).step(0.01).name('opacité');
        let coneSelectTransport: dat.GUIController = coneFolder.add(conf, 'type de transport', this._merger.transportNames);
        coneSelectTransport.onChange((v) => {
            if (!_lookupTransportColor.hasOwnProperty(v)) {
                _lookupTransportColor[v] = { color: '#ff0000', opacity: 1 };
            }
            coneColor.setValue(_lookupTransportColor[v].color).updateDisplay();
            coneOpacity.setValue(_lookupTransportColor[v].opacity).updateDisplay();
        });
        let coneColor = coneFolder.addColor(conf, 'couleur des cônes');
        coneColor.onChange(colorListener);
        let coneOpacity = coneFolder.add(conf, 'transparence des cônes', 0, 1).step(0.01);
        coneOpacity.onChange(colorListener);

        // lignes
        let lineFolder = gui.addFolder('Lignes');
        function lineListener(): void {
            let opacity = <number>lineOpacity.getValue();
            let color = parseInt(lineColor.getValue().replace('#', ''), 16);
            that._cones.lineCollection.forEach((line) => {
                let material = (<LineBasicMaterial>line.material);
                material.color.setHex(color);
                material.opacity = opacity;
            });
        }
        lineFolder.add(CONFIGURATION, 'pointsPerLine', 0, 200).step(1).name('nombre de points');
        let lineColor = lineFolder.addColor(conf, 'couleur des lignes');
        lineColor.onChange(lineListener);
        let lineOpacity = lineFolder.add(conf, 'transparence des lignes', 0, 1).step(0.01);
        lineOpacity.onChange(lineListener);

        // pays /mise en exergue avec listen?
        let countryFolder = gui.addFolder('pays');
        countryFolder.add(this._countries, 'show');
        countryFolder.add(this._countries, 'opacity', 0, 1).step(0.01).name('opacité');
        countryFolder.add(this._countries, 'extruded', -100, 100).step(1);
        let countryControllersList: dat.GUI[] = [];
        DragnDrop(
            this._container, list => {
                if (_filesData.length === 0) {
                    this._countries.ready = false;
                }
                _filesData.push(...list);
                let json: string;
                _filesData.forEach(item => {
                    let name = item.name.toLowerCase();
                    if (name.endsWith('.geojson')) {
                        json = item.text;
                    } else if (name.endsWith('.csv')) {
                        this._merger.add(item.text);
                        if (this.state === 'ready') {
                            this._merger.merge();
                        }
                    }
                });
                new Promise(resolve => {
                    if (this._countries.ready === false && json !== undefined) {
                        this._countries.add(JSON.parse(json)).then(() => {
                            while (countryControllersList.length > 0) {
                                let subGui = countryControllersList.pop();
                                (<any>countryFolder).removeFolder(subGui);
                            }
                            let synonymes: string[] = [];
                            this._countries.countryMeshCollection.sort((a, b) => a.mainName.localeCompare(b.mainName))
                                .forEach(country => {
                                    let countryName = country.mainName;
                                    let i = -1;
                                    while (synonymes.indexOf(countryName) > -1) {
                                        i++;
                                        countryName = country.mainName + i;
                                    }
                                    synonymes.push(countryName);
                                    let folder = countryFolder.addFolder(countryName);
                                    folder.add(country, 'extruded', -100, 100).step(1).listen();
                                    folder.add(country, 'visible').listen();
                                    folder.add(country.material, 'opacity', 0, 1).step(0.01).listen();
                                    countryControllersList.push(folder);
                                });
                            resolve();
                        });
                    } else {
                        resolve();
                    }
                }).then(() => {
                    if (this._countries.ready === true && this.state === 'complete') {
                        _lookupTransportColor = {};
                        annees.min(this._merger.minYear).max(this._merger.maxYear).updateDisplay();
                        coneSelectTransport.options(this._merger.transportNames).setValue(this._merger.transportNames[0]).updateDisplay();
                        this._cones.add(this._merger.datas, CONFIGURATION.extrudedHeight);
                        this._merger.clear();
                        _filesData = [];
                    }
                });
            },
            this);
    }

}
