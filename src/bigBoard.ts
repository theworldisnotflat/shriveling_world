declare var Stats: any;
namespace shriveling {
    'use strict';
    export class BigBoard {
        // prepare new datas for cones
        // configuration helper (radians, pourcentage...)?

        // merge datas to stock and generate cones
        public projectionNames: string[];
        private _cones: ConeBoard;
        private _countries: CountryBoard;
        private _container: HTMLDivElement;
        private _stats: any;
        private _controls: THREE.OrbitControls;

        private _camera: THREE.PerspectiveCamera;
        private _scene: THREE.Scene;
        private _renderer: THREE.WebGLRenderer;
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
            this._cones = new ConeBoard(this._projectionName, this._scene, this._camera, this._countries);
            let that = this;
            DragnDrop(
                this._container, (text, name) => {
                    if (name.toLowerCase().endsWith('.csv')) {
                        that._merger.add(text);
                        if (that.state === 'ready') {
                            that._merger.merge();
                        }
                    } else if (name.toLowerCase().endsWith('.geojson')) {
                        that._countries.add(JSON.parse(text));
                        console.log(that._countries);
                    }
                    if (that._merger.state === 'complete' && that._countries.countryMeshCollection.length > 0) {
                        that._cones.add(that._merger.datas, Configuration.extrudedHeight);
                    }
                },
                this);
            //
            /*            container.addEventListener('dblclick', (evt) => {
                            if (countryBoard) {
                                let name = countryBoard.getMeshByMouse(evt, true);
                                console.log(name);
                            }
                        });
                        */
            this._animate();
        }

        get projection(): string {
            return this._projectionName;
        }
        set projection(value: string) {
            if (this.projection.indexOf(value) > -1) {
                this._countries.changeProjection(value, Configuration.TWEEN_TIMING);
                let that = this;
                setTimeout(
                    () => {
                        that._cones.projection = value;
                    },
                    Configuration.TWEEN_TIMING);
            }
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

        get year(): string {
            return this._cones.year;
        }
        set year(value: string) {
            this._cones.year = value;
        }

        get lookupCountries(): ISumUpCriteria {
            return this._countries.lookupCriterias;
        }

        get lookupCones(): ISumUpCriteria {
            return this._cones.lookupCriterias;
        }

        get state(): IMergerState {
            return this._merger.state;
        }

        public updateConfiguration(): void {
            this.projectionNames = Object.keys(mapProjectors);
            Configuration.prepareConfiguration();
        }

        public cleanCountries(): void {
            this._countries.clean();
            this._cones.regenerateLimits();
        }

        public addCountries(geoJson: any): void {
            this._countries.add(geoJson);
            this._cones.regenerateLimits();
        }

        public cleanCones(): void {
            this._cones.clean();
        }

        public addCones(lookup: IlookupTownTransport): void {
            this._cones.add(lookup, Configuration.extrudedHeight);
        }

        public getCountryByMouse(event: MouseEvent, highLight: boolean = false): CountryMesh {
            return this._countries.getMeshByMouse(event, highLight);
        }

        public getConeByMouse(event: MouseEvent, highLight: boolean = false): ConeMesh {
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

        public getCones(criterias: ICriterias): ConeMesh[] {
            let resultat: ConeMesh[] = [];
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
            this._camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 15000);
            this._camera.position.set(0, 0, 500);

            this._scene = new THREE.Scene();
            this._scene.add(this._camera);
            this._camera.lookAt(this._scene.position);
            this._scene.fog = new THREE.Fog(0x000000, 1, 15000);

            let light = new THREE.PointLight(0xffffff);
            light.position.set(1000, 1000, 1000);
            this._scene.add(light);

            let ambient = new THREE.AmbientLight(0xffffff);
            this._scene.add(ambient);

            this._renderer = new THREE.WebGLRenderer({ antialias: true });
            this._renderer.setClearColor(0x222222);
            this._renderer.setPixelRatio(window.devicePixelRatio);
            this._renderer.setSize(window.innerWidth, window.innerHeight);
            this._renderer.sortObjects = false;
            this._container.appendChild(this._renderer.domElement);
            this._controls = new THREE.OrbitControls(this._camera, this._renderer.domElement);

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
            let loader = new THREE.TextureLoader();
            let materialArray = Configuration.SKYBOX_URLS.map((url) =>
                new THREE.MeshBasicMaterial({
                    map: loader.load(url),
                    side: THREE.BackSide,
                }));

            let skyGeometry = new THREE.CubeGeometry(10000, 10000, 10000);
            let skyMaterial = new THREE.MultiMaterial(materialArray);
            let skybox = new THREE.Mesh(skyGeometry, skyMaterial);
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
        }

    }
}
