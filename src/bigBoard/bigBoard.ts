    'use strict';
    import { CONFIGURATION } from '../common/configuration';
    import {
        MeshBasicMaterial, DoubleSide, MeshPhongMaterial, PerspectiveCamera, MeshStandardMaterial,
        OrbitControls, Scene, WebGLRenderer, BackSide, CubeGeometry, DirectionalLight, Fog,
        AmbientLight, Mesh, LineBasicMaterial, PCFSoftShadowMap, PlaneBufferGeometry,
        DirectionalLightHelper, Group, OrthographicCamera, GLTFExporter,
        FontLoader, TextGeometry, TextureLoader, Font, Vector3, ShaderMaterial, OutlinePass, EffectComposer,
        Vector2, UniformsUtils, Color, RenderPass, AdditiveBlending, FrontSide, MultiplyBlending} from 'three';
    import saveAs from 'file-saver';
    import {OBJExporter} from 'three-obj-exporter-t';
    import { ConeBoard } from '../cone/coneBoard';
    import { CountryBoard } from '../country/countryBoard';
    import { Merger } from './merger';
    import { Cartographic, DragnDrop } from '../common/utils';
    import {
        configurationObservableEvt, IMergerState, ISumUpCriteria, ILookupAndMaxSpeedAndLine, ICriterias,
        IListFile,
    } from '../definitions/project';
    import { PseudoCone } from '../cone/base';
    import { CountryMeshShader } from '../country/countryMeshShader';
    import { LineMeshShader } from '../cone/lineMeshShaders';
    import * as dat from 'dat.gui';

    declare let Stats: any;
    let option: any;

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
                // transparent: false,
                opacity: 0.8,
                color: 0xebdede,
                side: DoubleSide,
                // shininess: 0,
                // specularMap: 0,
                // roughness: 0,
                // metalness: 0.5,
            });
            CONFIGURATION.BASIC_TEXT_MATERIAL = new MeshPhongMaterial({
                // transparent: false,
                opacity: 1.0,
                color: 0xebdede,
                side: DoubleSide,
                // shininess: 0,
                // specularMap: 0,
                // roughness: 0,
                // metalness: 0.5,
            });
            // (<MeshPhongMaterial>CONFIGURATION.BASIC_CONE_MATERIAL).map = new TextureLoader().load(CONFIGURATION.CONE_TEXTURE);
            CONFIGURATION.BASIC_LINE_MATERIAL = new LineBasicMaterial({
                color: 0x1000ff, linewidth: .5, side: DoubleSide, transparent: true, opacity: 0.3,
            });
        }

    }
    let _filesData: IListFile[] = [];
    let _light = new DirectionalLight(0x000fff, 15); // (0xffffff, 5, 1000, 2);
    _light.castShadow = true;
    _light.shadow.mapSize.width = 512;  // default
    _light.shadow.mapSize.height = 512; // default
    _light.shadow.camera.near = 0.5;       // default
    _light.shadow.camera.far = 800;    // default

    // let  _light = new DirectionalLight( 0xefefff, 1.5 );
    _light.position.set(-1, -0.197, 0.377).normalize();

    let _light2 = new DirectionalLight(0xffefef, 1.5);

    let _ambient = new AmbientLight(0xffffff);

    // let _gltfExporter = new GLTFExporter();

    function exportGLTF(input: any): void {
        let _gltfExporter = new GLTFExporter();
        let options = {
            trs: true, // document.getElementById('option_trs').checked,
            onlyVisible: true, // document.getElementById('option_visible').checked,
            // truncateDrawRange: true, // document.getElementById('option_drawrange').checked,
            // binary: true, // document.getElementById('option_binary').checked,
            // forceIndices: false, // document.getElementById('option_forceindices').checked,
            // forcePowerOfTwoTextures: false, // document.getElementById('option_forcepot').checked,
        };
        _gltfExporter.parse(
            input, (result) => {
                if (result instanceof ArrayBuffer) {
                    saveArrayBuffer(result, 'scene.glb');
                } else {
                    let output = JSON.stringify(result, null, 2);
                    console.log(output);
                    saveString(output, 'scene.gltf');
                }
            },
            options);
    }

    let link = document.createElement('a');
    function save(blob: any, filename: string): void {
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
    }
    function saveString(text: string, filename: string): void {
        save(new Blob([text], { type: 'text/plain' }), filename);
    }
    function saveArrayBuffer(buffer: ArrayBuffer, filename: string): void {
        save(new Blob([buffer], { type: 'application/octet-stream' }), filename);
    }

    export default class BigBoard {
        public static configuration: any = CONFIGURATION;
        private _cones: ConeBoard;
        private _countries: CountryBoard;
        private _container: HTMLDivElement;
        private _stats: any;
        private _controls: OrbitControls;

        // is orthographic camera
        private orthographique: boolean;
        private _cameraO: OrthographicCamera;
        private _cameraP: PerspectiveCamera;
        //
        private _showCitiesName: boolean;
        private _exportCountry: boolean;
        private _exportLine: boolean;
        private _populations: number;
        private _sizetexte: number;
        private _scene: Scene;
        private _renderer: WebGLRenderer;
        private _windowHalfX: number = window.innerWidth / 2;
        private _windowHalfY: number = window.innerHeight / 2;
        private _merger: Merger;
        private _helper: DirectionalLightHelper;

        // noeud ajout nom Ville
        private _geometryText: Group;
        private loaderFont: FontLoader;

        constructor() {
            this.loaderFont = new FontLoader();
            this.loaderFont.load( 'gentilis_regular.typeface.json', function ( font: Font ): void {
                option = {
                    font: font,
                    size: 0.3,
                    height: 1,
                    curveSegments: 3,
                    bevelEnabled: false,
                    bevelThickness: 0,
                    bevelSize: 0,
                    bevelSegments: 0,
                 };

            });
            prepareConfiguration();
            this._merger = new Merger();
            this._init();
            this.orthographique = true;

            this._countries = new CountryBoard(this._scene, this._cameraO);
            this._countries.show = true;
            this._cones = new ConeBoard(this._scene, this._cameraO, this._countries, this._renderer);
            CONFIGURATION.year = '2010';
            this._showCitiesName = true;

            this.initInteraction();
            this._animate();
        }
        public toggleShowCity(): void {
            this._showCitiesName = !this._showCitiesName;
        }

        get getMergerI(): Merger {
            return this._merger;
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
        public showCitiesName(): void {
            console.log(this._showCitiesName);
            if ( this._showCitiesName === false ) {
                for ( var i = this._geometryText.children.length - 1 ; i >= 0 ; i--) {
                    this._geometryText.remove(this._geometryText.children[i]);
                }
            } else {
                this.updateNameTown(option);
            }
        }
        public rescaleText(): void {
            console.log(this._sizetexte);
            for ( var i = this._geometryText.children.length - 1 ; i >= 0 ; i--) {
                this._geometryText.children[i].scale.set(this._sizetexte, this._sizetexte, this._sizetexte);
            }
        }
        public updateNameTown(option?: any): void {
            if (this._merger.state !== 'complete') {
                return;
            }
            var mesh;

            for ( var i = this._geometryText.children.length - 1 ; i >= 0 ; i--) {
                this._geometryText.remove(this._geometryText.children[i]);
            }
            for ( var j = 0 ; j < this.getMergerI.Cities.length / 2  ; j++ ) {
                    var obj = JSON.parse(JSON.stringify(this.getMergerI.Cities[j]));
                    var pop = JSON.parse(JSON.stringify(
                                this._merger.mergedData.lookupTownTransport[this.getMergerI.Cities[j].cityCode]
                                .cityProperties.populations));
                    var population = pop.pop2020;
                    if (population > this._populations) {
                        var geometry = new TextGeometry(obj.urbanAgglomeration , option );
                        mesh = new Mesh( geometry, CONFIGURATION.BASIC_TEXT_MATERIAL );
                        let cart = this._merger.mergedData.lookupTownTransport[this.getMergerI.Cities[j].cityCode].referential.cartoRef;
                        let x =  - CONFIGURATION.THREE_EARTH_RADIUS * 1.1 * Math.cos(cart.latitude * 0.95) * Math.cos(cart.longitude);
                        let y =  CONFIGURATION.THREE_EARTH_RADIUS  * 1.1 *  Math.sin(cart.latitude * 0.95);
                        let z =  CONFIGURATION.THREE_EARTH_RADIUS * 1.1  * Math.cos(cart.latitude * 0.95) * Math.sin(cart.longitude);
                        this._geometryText.add(mesh);
                        mesh.position.set(x, y, z);
                        mesh.lookAt(new Vector3(x * 2, y * 2, z * 2));

                        // mesh.rotation.set(0,Math.cos(cart.latitude*CONFIGURATION.rad2deg),0);
                    }
                }
            this.rescaleText();
        }

        private _init(): void {
            this._container = document.createElement('div');
            document.body.appendChild(this._container);
            this._stats = new Stats();
            this._stats.domElement.style.position = 'absolute';
            this._stats.domElement.style.bottom = '0px';
            this._stats.domElement.style.zIndex = 100;
            this._container.appendChild(this._stats.domElement);
            this._cameraP = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 15000);
            this._cameraO = new OrthographicCamera( -this._windowHalfX ,
                                                    this._windowHalfX , this._windowHalfY, -this._windowHalfY, 1, 2000 );
            this._cameraO.position.set(0, 0, 500);
            this._cameraP.position.set(0, 0, 500);
            this._populations = 0;
            this._exportCountry = false;
            this._exportLine = true;
            this._sizetexte = 1.0;
            this._scene = new Scene();
            this._scene.add(this._cameraO);
            this._scene.add(this._cameraP);

            this._cameraO.lookAt(this._scene.position);
            this._cameraP.lookAt(this._scene.position);
            this._scene.fog = new Fog(0x000000, 1, 15000);
            this._geometryText = new Group();

            _light.position.set(1, 1, 1);
            this._scene.add(_light);

            this._helper = new DirectionalLightHelper(_light);
            this._scene.add(this._helper);

            this._scene.add(_ambient);
            this._scene.add(this._geometryText);

            this._renderer = new WebGLRenderer({ antialias: true });
            this._renderer.shadowMap.enabled = true;
            this._renderer.shadowMap.type = PCFSoftShadowMap;

            this._renderer.setClearColor(0xffffff);
            this._renderer.setPixelRatio(window.devicePixelRatio);
            this._renderer.setSize(window.innerWidth, window.innerHeight);
            // this._renderer.sortObjects = false;
            let planeGeometry = new PlaneBufferGeometry(1000, 1000, 32, 32);
            let planeMaterial = new MeshStandardMaterial({ color: 0x00ff00 });
            let plane = new Mesh(planeGeometry, planeMaterial);
            plane.position.z = -200;
            plane.receiveShadow = true;
            // plan vert
            // this._scene.add(plane);
            this._container.appendChild(this._renderer.domElement);
            this._controls = new OrbitControls(this._cameraO, this._renderer.domElement);
            window.addEventListener(
                'resize', () => {
                    this._windowHalfX = window.innerWidth / 2;
                    this._windowHalfY = window.innerHeight / 2;

                    this._cameraP.aspect = window.innerWidth / window.innerHeight;
                    this._cameraP.updateProjectionMatrix();
                    // this.updateCamera();

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
            let skybox = new Mesh(skyGeometry, materialArray);
            // this._scene.add(skybox);

            let saveButton = document.createElement('button');
            saveButton.innerHTML = 'sauvegarde';
            let style = saveButton.style;
            style.zIndex = '1000';
            style.position = 'fixed';
            style.bottom = '0px';
            style.left = '0px';
            style.backgroundColor = 'red';
            document.body.appendChild(saveButton);
            saveButton.addEventListener('click', () => {
                // exportGLTF(this._scene);

                this.exporterOBJ();
            });

    }

        private exporterOBJ(): void {
            var exporter = new OBJExporter();
            alert('Export begin...');
            var result = '';
            var group = new Group();
            var groupLine = new Group();
            if (this._exportCountry) {
                for (var i = 0; i < this._countries.countryMeshCollection.length; ++i) {
                    var cloned = this._countries.countryMeshCollection[i];
                    group.add(cloned);
                }
            }
            if (this._exportLine) {
                for (var k = 0; k < this._cones.lineCollection.length; ++k) {
                    var clonedLine = this._cones.lineCollection[k];
                    groupLine.add(clonedLine);
                }
            }
            for (var j = 0; j < this._cones.coneMeshCollection.length - 636; ++j) {
                var clonedCone = this._cones.coneMeshCollection[j];
                group.add(clonedCone);
            }
            group.add(groupLine);
            var blob = new Blob([exporter.parse(group)], { type: 'text/plain;charset=utf-8' });
            saveAs(blob, 'scene.obj');
            this._scene.add(group);
            alert('Export end.');
        }

        private updateCamera(): void {
            this._windowHalfX = window.innerWidth / 2;
            this._windowHalfY = window.innerHeight / 2;
            this._cameraO.left = -this._windowHalfX;
            this._cameraO.right = this._windowHalfX;
            this._cameraO.top = this._windowHalfY;
            this._cameraO.left = -this._windowHalfY;
            this._cameraP.aspect = window.innerWidth / window.innerHeight;
            this._cameraO.updateProjectionMatrix();
            this._cameraP.updateProjectionMatrix();
        }

        private _animate(): void {
            let scene = this._scene;
            let camera = (this.orthographique) ? this._cameraO : this._cameraP;
            this._controls.object  = camera ;
            requestAnimationFrame(() => this._animate());
            this._renderer.render(scene, camera);
            this._stats.update();
            this._controls.update();
            TWEEN.update();
            CONFIGURATION.tick();
        }

        // show/Unshown city Name
        private initInteraction(): void {

            const gui = new dat.GUI();
            let conf = {
                coneStep: CONFIGURATION.coneStep * CONFIGURATION.rad2deg,
                year: parseInt(<string>CONFIGURATION.year, 10),
                projection: { aucun: 0, equirectangulaire: 1, Mercator: 2, Winkel: 3, Eckert: 4,
                    'Van Der Grinten': 5, 'conic equidistant': 6 },
                'type de transport': '',
                'couleur cones': '#' + (<any>CONFIGURATION.BASIC_CONE_MATERIAL).color.getHex().toString(16),
                'transparence des cônes': CONFIGURATION.BASIC_CONE_MATERIAL.opacity,
                'couleur des lignes': '#' + CONFIGURATION.BASIC_LINE_MATERIAL.color.getHex().toString(16),
                'couleur du texte': '#' + CONFIGURATION.BASIC_TEXT_MATERIAL.color.getHex().toString(16),
                'transparence des lignes': CONFIGURATION.BASIC_LINE_MATERIAL.opacity,
                'couleur lumière': '#' + _light.color.getHex().toString(16),
                'intensity': _light.intensity,
                'couleur ambient': '#' + _ambient.color.getHex().toString(16),
                'longitude': CONFIGURATION.referenceEquiRectangular.longitude,
                'latitude': CONFIGURATION.referenceEquiRectangular.latitude,
                'hauteur': CONFIGURATION.referenceEquiRectangular.height,
                'parallèle standard 1': CONFIGURATION.standardParallel1 * CONFIGURATION.rad2deg,
                'parallèle standard 2': CONFIGURATION.standardParallel2 * CONFIGURATION.rad2deg,
                'with limits': true,
            };

            let that = this;
            // lumière
            let lightFolder = gui.addFolder('lumière');
            lightFolder.add(_ambient, 'intensity', 0, 5, 0.01).name('intensité ambiante');
            lightFolder.addColor(conf, 'couleur lumière').onChange(v => {
                let color = parseInt(v.replace('#', ''), 16);
                _light.color.setHex(color);
                this._helper.color = color;
                this._helper.update();
            });
            lightFolder.addColor(conf, 'couleur ambient').onChange(v => {
                let color = parseInt(v.replace('#', ''), 16);
                _ambient.color.setHex(color);
            });
            lightFolder.add(conf, 'intensity', 0, 5, 0.01).name('intensité lumière').onChange(v => {
                _light.intensity = v;
                console.log(_light.intensity);
                this._helper.update();

            });

            lightFolder.add(_light.position, 'x', -100, 100, 1).onChange(v => this._helper.update());
            lightFolder.add(_light.position, 'y', -100, 100, 1).onChange(v => this._helper.update());
            lightFolder.add(_light.position, 'z', -100, 100, 1).onChange(v => this._helper.update());
            lightFolder.add(_light.shadow.mapSize, 'width', 0, 1000).step(1);
            lightFolder.add(_light.shadow.mapSize, 'height', 0, 1000).step(1);
            lightFolder.add(_light.shadow.camera, 'near', 0, 1000).step(0.5);
            lightFolder.add(_light.shadow.camera, 'far', 0, 1000).step(1);

            // généralités
            let generalFolder = gui.addFolder('Généralités');
            let projectionFolder = generalFolder.addFolder('projection');
            let referenceFolder = projectionFolder.addFolder('references');
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
            referenceFolder.add(conf, 'parallèle standard 1', -90, 90, 0.1)
                .onChange(v => CONFIGURATION.standardParallel1 = v * CONFIGURATION.deg2rad);
            referenceFolder.add(conf, 'parallèle standard 2', -90, 90, 0.1)
                .onChange(v => CONFIGURATION.standardParallel2 = v * CONFIGURATION.deg2rad);
            projectionFolder.add(CONFIGURATION, 'projectionInit', conf.projection).name('projection initiale');
            projectionFolder.add(CONFIGURATION, 'projectionEnd', conf.projection).name('projection finale');
            projectionFolder.add(CONFIGURATION, 'percentProjection', 0, 100).step(1).name('transition projection');
            let annees = generalFolder.add(conf, 'year', 1930, 2030).step(1);
            annees.onChange(v => CONFIGURATION.year = v);

            // toggle Camera Orthograpgic/Perspectiv View
            function changeCameraView(): void {
                this.orthographique = !this.orthographique;
            }
            let swapView = projectionFolder.add(this, 'orthographique');
            swapView.onChange(changeCameraView);
            generalFolder.add(this, '_showCitiesName').name('Show Cities name').onChange(this.showCitiesName.bind(this));

            // cônes
            let coneFolder = gui.addFolder('Cones');

            coneFolder.add(conf, 'coneStep', 1, 360).step(1).
                onChange(value => CONFIGURATION.coneStep = value * CONFIGURATION.deg2rad);
            coneFolder.add(this, 'withLimits').onChange(value => conf['with limits'] = value);
            coneFolder.add(this._cones, 'opacity', 0, 1).step(0.01).name('opacité');
            let terresterialFolder = coneFolder.addFolder('configurations spécifiques');
            let terrestrialControllersList: dat.GUI[] = [];
            let flagTransportDone = false;

            // lignes
            let aerialFolder = gui.addFolder('Lignes');
            aerialFolder.add(LineMeshShader, 'coefficient', 0, 10, 0.1);  // .1 en dernière position
            aerialFolder.add(CONFIGURATION, 'pointsPerLine', 0, 200).step(1).name('nombre de points');
            function exportLine(): void {
                this.orthographique = !this.orthographique;
            }
            aerialFolder.add(this, '_exportLine').name('Export Lignes').onChange(exportLine);

            let aerialControllersList: dat.GUI[] = [];

            // pays /mise en exergue avec listen?
            let countryFolder = gui.addFolder('pays');
            countryFolder.add(this._countries, 'show');
            countryFolder.add(this._countries, 'opacity', 0, 1).step(0.01).name('opacité');
            countryFolder.add(this._countries, 'extruded', -100, 100).step(1);
            function exportCountry(): void {
                this.orthographique = !this.orthographique;
            }
            countryFolder.add(this, '_exportCountry').name('Export Continent').onChange(exportCountry);
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
                    Promise.all([
                        new Promise(resolve => {
                            if (this._countries.ready === false && json !== undefined) {
                                this._countries.add(JSON.parse(json)).then(() => {
                                    while (countryControllersList.length > 0) {
                                        let subGui = countryControllersList.pop();
                                        countryFolder.removeFolder(subGui);
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
                        }),
                        new Promise(resolve => {
                            if (this.state === 'complete' && flagTransportDone === false) {
                                flagTransportDone = true;
                                while (terrestrialControllersList.length > 0) {
                                    let subGui = terrestrialControllersList.pop();
                                    terresterialFolder.removeFolder(subGui);
                                }
                                this._merger.transportNames.cones.forEach(transportName => {
                                    let folder = terresterialFolder.addFolder(transportName);
                                    terrestrialControllersList.push(folder);
                                    function colorListener(): void {
                                        let opacity = <number>coneOpacity.getValue();
                                        let color = parseInt(coneColor.getValue().replace('#', ''), 16);
                                        let limits = <boolean>coneLimits.getValue();
                                        that._cones.coneMeshCollection.filter((cone) => transportName === cone.transportName)
                                            .forEach((cone) => {
                                                let material = (<MeshPhongMaterial>cone.material);
                                                material.color.setHex(color);
                                                material.opacity = opacity;
                                                cone.withLimits = limits;
                                            });
                                    }
                                    let coneColor = folder.addColor(conf, 'couleur cones').name('couleur');
                                    coneColor.onChange(colorListener);
                                    let coneOpacity = folder.add(conf, 'transparence des cônes', 0, 1, .01).name('transparence');
                                    coneOpacity.onChange(colorListener);
                                    let coneLimits = folder.add(conf, 'with limits').listen();
                                    coneLimits.onChange(colorListener);
                                });

                                while (aerialControllersList.length > 0) {
                                    let subGui = aerialControllersList.pop();
                                    aerialFolder.removeFolder(subGui);
                                }
                                this._merger.transportNames.lines.forEach(transportName => {
                                    let folder = aerialFolder.addFolder(transportName);
                                    aerialControllersList.push(folder);
                                    function lineListener(): void {
                                        let opacity = <number>lineOpacity.getValue();
                                        let color = parseInt(lineColor.getValue().replace('#', ''), 16);
                                        that._cones.lineCollection.filter((line) => transportName === line.transportName)
                                            .forEach((line) => {
                                                let material = (<LineBasicMaterial>line.material);
                                                material.color.setHex(color);
                                                material.opacity = opacity;
                                            });
                                    }
                                    let lineColor = folder.addColor(conf, 'couleur des lignes').name('couleur');
                                    lineColor.onChange(lineListener);
                                    let lineOpacity = folder.add(conf, 'transparence des lignes', 0, 1, .01).name('transparence');
                                    lineOpacity.onChange(lineListener);
                                });
                            }
                            resolve();
                        })]).then(() => {
                            if (this._countries.ready === true && this.state === 'complete') {
                                flagTransportDone = false;
                                annees.min(this._merger.minYear).max(this._merger.maxYear).updateDisplay();
                                this._cones.add(this._merger.datas, CONFIGURATION.extrudedHeight);
                                // this._merger.clear();
                                let sizeText = generalFolder.add(this, '_sizetexte', 0, 2).name('taille du texte').step(0.1);
                                sizeText.onChange(this.rescaleText.bind(this));
                                generalFolder.addColor(conf, 'couleur du texte').onChange(v => {
                                    let color = parseInt(v.replace('#', ''), 16);
                                    CONFIGURATION.BASIC_TEXT_MATERIAL.color.setHex(color);
                                    this.updateNameTown.bind(this, option);
                                });
                                let population = generalFolder.add(this, '_populations', 0, 10000 ).name('Seuil population').step(10)
                                .setValue(this._populations)
                                .onChange(this.updateNameTown.bind(this, option));
                                _filesData = [];

                            }
                        });
                },
                this);
        }
    }
