'use strict';
import { CONFIGURATION } from '../common/configuration';
import {
  MeshBasicMaterial, DoubleSide, MeshPhongMaterial, PerspectiveCamera, Scene,
  WebGLRenderer, DirectionalLight, Fog, AmbientLight, Mesh, LineBasicMaterial, PCFSoftShadowMap,
  DirectionalLightHelper, Group, OrthographicCamera, FontLoader, TextGeometry, TextureLoader, Vector3,
  OrbitControls, OBJExporter,
} from 'three';
import { ConeBoard } from '../cone/coneBoard';
import { CountryBoard } from '../country/countryBoard';
import { Merger } from './merger';
import { DragnDrop } from '../common/utils';
import { IMergerState, ISumUpCriteria, ILookupAndMaxSpeedAndLine, ICriterias, IListFile } from '../definitions/project';
import { PseudoCone } from '../cone/base';
import { CountryMeshShader } from '../country/countryMeshShader';
import * as dat from 'dat.gui';
import * as kit from '@brunoimbrizi/controlkit';
// import from '../definitions/controlKit';

declare module 'three' {
  export class OrbitControls {
    public object: OrthographicCamera | PerspectiveCamera;
    constructor(camera: OrthographicCamera | PerspectiveCamera, render: HTMLCanvasElement);
    public update(): void;
  }
  export class OBJExporter {
    constructor();
    public parse(group: Group): any;
  }
}

declare let Stats: any;
/**
 * initialise les données de ThreeJS pour l'application (textures, couleurs...)
 *
 * initialising the threejs data of the application (textures, colors, ect.)
 */
function prepareConfiguration(): void {
  if (CONFIGURATION.COUNTRY_MATERIAL === undefined) {
    CONFIGURATION.highLitedMaterial = new MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.5,
      side: DoubleSide,
    });
    let earthMaterial = new MeshBasicMaterial({
      opacity: 0.8,
      depthTest: true,
      depthWrite: true,
      side: DoubleSide,
      transparent: true,
    });
    earthMaterial.map = new TextureLoader().load(CONFIGURATION.COUNTRY_TEXTURES.map);
    earthMaterial.specularMap = new TextureLoader().load(CONFIGURATION.COUNTRY_TEXTURES.specularMap);
    CONFIGURATION.COUNTRY_MATERIAL = earthMaterial;
    CONFIGURATION.BASIC_CONE_MATERIAL = new MeshPhongMaterial({
      opacity: 0.8,
      color: 0xebdede,
      side: DoubleSide,
    });
    CONFIGURATION.BASIC_TEXT_MATERIAL = new MeshPhongMaterial({
      opacity: 1.0,
      color: 0xebdede,
      side: DoubleSide,
    });
    // (<MeshPhongMaterial>CONFIGURATION.BASIC_CONE_MATERIAL).map = new TextureLoader().load(CONFIGURATION.CONE_TEXTURE);
    CONFIGURATION.BASIC_LINE_MATERIAL = new LineBasicMaterial({
      color: 0x1000ff,
      linewidth: 0.5,
      side: DoubleSide,
      transparent: true,
      opacity: 0.3,
    });
    let loaderFont = new FontLoader();
    loaderFont.load('gentilis_regular.typeface.json', font => {
      CONFIGURATION.TEXT_GEOMETRY_OPTIONS = {
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
  }
}
let _filesData: IListFile[] = [];

let link = document.createElement('a');
/**
 * Export in Wavefront OBJ format.
 * Exported file can be imported in Blender.
 *
 * Two files a generated:
 * * sceneCones.obj
 * * sceneLines.obj
 *
 * @param blob     data table in blob format
 * @param filename filename of data table (location to user choice)
 *
 */
function save(blob: any, filename: string): void {
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

/**
 * C'est la classe qui contrôle toute l'application: la liste des cônes, pays et
 *  lignes ainsi que la scene THREE.JS + les commandes et le comportement...
 *
 * This class controls all the application: the list of [[_cones]], [[_countries]], lines
 * This is where the THREE.JS scene is defined with commands and behaviors
 */
export default class BigBoard {
  /**
   * La configuration de l'application accessible en statique!
   *
   * the configuration of the app, available in static
   */
  public static configuration: any = CONFIGURATION;
  /**
   * liste des cônes (un cône correspond à une ville et un type de transport)
   *
   * list of cones: a [[_cone]] corresponds to a city and a type of terrestrial transport
   */
  public helper: DirectionalLightHelper;
  public light: DirectionalLight;
  public ambient: AmbientLight;
  public coneBoard: ConeBoard;
  /**
   * liste des pays générés depuis un fichier geojson
   */
  public countryBoard: CountryBoard;
  // is orthographic camera
  public orthographique: boolean;
  private _container: HTMLDivElement;
  private _stats: any;
  private _controls: OrbitControls;

  private _cameraO: OrthographicCamera;
  private _cameraP: PerspectiveCamera;
  //
  private _showCitiesName: boolean;
  private _populations: number;
  private _sizetext: number;
  private _scene: Scene;
  private _renderer: WebGLRenderer;
  private _windowHalfX: number = window.innerWidth / 2;
  private _windowHalfY: number = window.innerHeight / 2;
  private _merger: Merger;

  // noeud ajout nom Ville
  private _geometryText: Group;

  constructor() {
    prepareConfiguration();
    this._merger = new Merger();
    this._init();
    this.orthographique = true;

    this.countryBoard = new CountryBoard(this._scene, this._cameraO);
    this.countryBoard.show = true;
    this.coneBoard = new ConeBoard(this._scene, this._cameraO, this.countryBoard, this._renderer);
    CONFIGURATION.year = '2010';
    this._showCitiesName = true;

    this.initInteraction();
    this._animate();
  }
  /**
   * Enable/Disable showCitiesName paramater in order to show/hide
   * cities names
   *
   * @memberof BigBoard
   */
  public toggleShowCity(): void {
    this._showCitiesName = !this._showCitiesName;
  }

  /**
   * Getter : Get merger parameter
   *
   * @readonly
   * @type {Merger}
   * @memberof BigBoard
   */
  get getMergerI(): Merger {
    return this._merger;
  }

  /**
   * Getter : Get scale parameter of the contries parameter
   *
   * @type {number}
   * @memberof BigBoard
   */
  get scaleCountries(): number {
    return this.countryBoard.scale;
  }
  /**
   * Setter : Update the value of scale parameter
   * @param {number} value
   * @memberof BigBoard
   */
  set scaleCountries(value: number) {
    this.countryBoard.scale = value;
  }

  /**
   * Getter : Get scale parameter of the cones parameter
   * @type {number}
   * @memberof BigBoard
   */
  get scaleCones(): number {
    return this.coneBoard.scale;
  }

  /**
   * Setter : Update the value of scale parameter
   * @param {number} value
   * @memberof BigBoard
   */
  set scaleCones(value: number) {
    this.coneBoard.scale = value;
  }

  /**
   * Getter: Get show parameter of contries paramter
   * @type {boolean}
   * @memberof BigBoard
   */
  get showCountries(): boolean {
    return this.countryBoard.show;
  }
  /**
   * Setter : Update the value of show paramater of contries parameter
   * @memberof BigBoard
   */
  set showCountries(value: boolean) {
    this.countryBoard.show = value;
  }

  /**
   * Getter: Get show parameter of cone parameter
   * @type {boolean}
   * @memberof BigBoard
   */
  get showCones(): boolean {
    return this.coneBoard.show;
  }
  /**
   * Setter : Update the value of show paramater of cones paramater
   * @param {boolean} value
   * @memberof BigBoard
   */
  set showCones(value: boolean) {
    this.coneBoard.show = value;
  }
  get lookupCountries(): ISumUpCriteria {
    return this.countryBoard.lookupCriterias;
  }
  get lookupCones(): ISumUpCriteria {
    return this.coneBoard.lookupCriterias;
  }

  /**
   * Getter : Get if the boundaries of the cones is limited by the contries
   * @type {boolean}
   * @memberof BigBoard
   */
  get withLimits(): boolean {
    return this.coneBoard.withLimits;
  }
  /**
   * Setter : update the withlimits paramater of the cones paramaters
   * if true the boundaries of cones will be limited by the boundaries of countries
   * @memberof BigBoard
   */
  set withLimits(value: boolean) {
    this.coneBoard.withLimits = value;
  }

  /**
    * Getter : Get the current state of the merger
    * @returns missing || ready || complete || pending
    * @readonly
    * @type {IMergerState}
    * @memberof BigBoard
    */
  get state(): IMergerState {
    return this._merger.state;
  }

  /**
   * @see contryBoard  : cleanCountries method
   * @memberof BigBoard
   */
  public cleanCountries(): void {
    this.countryBoard.clean();
  }

  public addCountries(geoJson: any): void {
    this.countryBoard.add(geoJson);
  }
  /**
   * @see coneBoard :  cleanCones method
   * @memberof BigBoard
   */
  public cleanCones(): void {
    this.coneBoard.clean();
  }

  /**
   * Add cone to the coneMeshCollection
   * @todo unused and irrelevant @see coneBoard.add
   * @param {ILookupAndMaxSpeedAndLine} lookup
   * @memberof BigBoard
   */
  public addCones(lookup: ILookupAndMaxSpeedAndLine): void {
    this.coneBoard.add(lookup);
  }

  /**
   * Get the contry through the position of the mouse
   * @todo unused and irrelevant @see coneBoard.getMeshByMouse
   * @param {MouseEvent} event
   * @param {boolean} [highLight=false]
   * @returns {CountryMeshShader}
   * @memberof BigBoard
   */
  public getCountryByMouse(event: MouseEvent, highLight: boolean = false): CountryMeshShader {
    return this.countryBoard.getMeshByMouse(event, highLight);
  }

  /**
   * Get the cone through the position of the mouse
   * @todo unused and irrelevant @see contryBoard.getMeshByMouse
   * @param {MouseEvent} event
   * @param {boolean} [highLight=false]
   * @returns {PseudoCone}
   * @memberof BigBoard
   */
  public getConeByMouse(event: MouseEvent, highLight: boolean = false): PseudoCone {
    return this.coneBoard.getMeshByMouse(event, highLight);
  }

  /**
   * Highlith countries @see contryBoard.highLight
   * @todo unused and irrelevant @see contryBoard.highLight
   * @param {ICriterias} criterias
   * @param {boolean} [light=true]
   * @memberof BigBoard
   */
  public highLightCountries(criterias: ICriterias, light: boolean = true): void {
    this.countryBoard.highLight(criterias, light);
  }

  /**
   * Highlight cones @see coneBoard.highLight
   * @todo unused and irrelevant @see coneBoard.highLight
   * @param {ICriterias} criterias
   * @param {boolean} [light=true]
   * @memberof BigBoard
   */
  public highLightCones(criterias: ICriterias, light: boolean = true): void {
    this.coneBoard.highLight(criterias, light);
  }

  /**
   * Update the withlimit parameter value of all cones in the [[coneMeshCollection]]
   * @todo unused and irrelevant @see coneBoard.setLimits
   * @param {ICriterias} criterias
   * @param {boolean} limit
   * @memberof BigBoard
   */
  public setLimits(criterias: ICriterias, limit: boolean): void {
    this.coneBoard.setLimits(criterias, limit);
  }

  /**
   * Show/Hide a countryMeshCollection
   * @todo unused and irrelevant @see contryBoard.showCriterias
   * @param {ICriterias} criterias
   * @param {boolean} state
   * @memberof BigBoard
   */
  public showCountriesCriterias(criterias: ICriterias, state: boolean): void {
    this.countryBoard.showCriterias(criterias, state);
  }

  /**
   * Show/Hide a coneMeshCollection
   * @todo unused and irrelevant @see contryBoard.showCriterias
   * @param {ICriterias} criterias
   * @param {boolean} state
   * @memberof BigBoard
   */
  public showConesCriterias(criterias: ICriterias, state: boolean): void {
    this.coneBoard.showCriterias(criterias, state);
  }

  /**
   * Get a contryMeshCollection with all contries verifying 'criterias'
   * @param {ICriterias} criterias
   * @returns {CountryMeshShader[]}
   * @memberof BigBoard
   */
  public getCountries(criterias: ICriterias): CountryMeshShader[] {
    let resultat: CountryMeshShader[] = [];
    if (this.countryBoard.show === true) {
      resultat = this.countryBoard.searchMesh(criterias);
    }
    return resultat;
  }

  /**
   * Get a coneMeshCollection with all cones verifying 'criterias'
   * @param {ICriterias} criterias
   * @returns {PseudoCone[]}
   * @memberof BigBoard
   */
  public getCones(criterias: ICriterias): PseudoCone[] {
    let resultat: PseudoCone[] = [];
    if (this.coneBoard.show === true) {
      resultat = this.coneBoard.searchMesh(criterias);
    }
    return resultat;
  }

  /**
   * Extrude contriesMeshCollection  with criterias by a factor value
   * @param {ICriterias} criterias
   * @param {number} [value]
   * @memberof BigBoard
   */
  public extrude(criterias: ICriterias, value?: number): void {
    this.countryBoard.extrude(criterias, value);
  }
  /**
   * Show Cities name
   * @memberof BigBoard
   */
  public showCitiesName(): void {
    if (this._showCitiesName === false) {
      for (var i = this._geometryText.children.length - 1; i >= 0; i--) {
        this._geometryText.remove(this._geometryText.children[i]);
      }
    } else {
      this.updateCityName();
    }
  }

  /**
   * Rescale all text by the sizetexte p
   * @memberof BigBoard
   */
  public rescaleText(): void {
    for (var i = this._geometryText.children.length - 1; i >= 0; i--) {
      this._geometryText.children[i].scale.set(this._sizetext, this._sizetext, this._sizetext);
    }
  }

  /**
    * Update all the town which will be displayed regarding the populuation threeshold paramater
    */
  public updateCityName(): void {
    if (this._merger.state !== 'complete') {
      return;
    }
    let mesh: Mesh;
    for (var i = this._geometryText.children.length - 1; i >= 0; i--) {
      this._geometryText.remove(this._geometryText.children[i]);
    }
    for (var j = 0; j < this.getMergerI.Cities.length / 2; j++) {
      var obj = JSON.parse(JSON.stringify(this.getMergerI.Cities[j]));
      var pop = JSON.parse(
        JSON.stringify(
          this._merger.mergedData.lookupCityTransport[this.getMergerI.Cities[j].cityCode].cityProperties
            .populations));
      var population = pop.pop2020;
      if (population > this._populations) {
        var geometry = new TextGeometry(obj.urbanAgglomeration, CONFIGURATION.TEXT_GEOMETRY_OPTIONS);
        mesh = new Mesh(geometry, CONFIGURATION.BASIC_TEXT_MATERIAL);
        let cart = this._merger.mergedData.lookupCityTransport[this.getMergerI.Cities[j].cityCode].referential
          .cartoRef;
        let x =
          -CONFIGURATION.THREE_EARTH_RADIUS * 1.1 * Math.cos(cart.latitude * 0.95) * Math.cos(cart.longitude);
        let y = CONFIGURATION.THREE_EARTH_RADIUS * 1.1 * Math.sin(cart.latitude * 0.95);
        let z =
          CONFIGURATION.THREE_EARTH_RADIUS * 1.1 * Math.cos(cart.latitude * 0.95) * Math.sin(cart.longitude);
        this._geometryText.add(mesh);
        mesh.position.set(x, y, z);
        mesh.lookAt(new Vector3(x * 2, y * 2, z * 2));

        // mesh.rotation.set(0,Math.cos(cart.latitude*CONFIGURATION.rad2deg),0);
      }
    }
    this.rescaleText();
  }

  /**
    * Initalize the scene
    * @private
    * @memberof BigBoard
    */
  private _init(): void {
    this._container = document.createElement('div');
    document.body.appendChild(this._container);
    this._stats = new Stats();
    this._stats.domElement.style.position = 'absolute';
    this._stats.domElement.style.bottom = '0px';
    this._stats.domElement.style.zIndex = 100;
    this._container.appendChild(this._stats.domElement);
    this._cameraP = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 15000);
    this._cameraO = new OrthographicCamera(
      -this._windowHalfX,
      this._windowHalfX,
      this._windowHalfY,
      -this._windowHalfY,
      1,
      2000);
    this._cameraO.position.set(0, 0, 500);
    this._cameraP.position.set(0, 0, 500);
    this._populations = 0;
    this._sizetext = 1.0;
    this._scene = new Scene();
    this._scene.add(this._cameraO);
    this._scene.add(this._cameraP);

    this._cameraO.lookAt(this._scene.position);
    this._cameraP.lookAt(this._scene.position);
    this._scene.fog = new Fog(0x000000, 1, 15000);
    this._geometryText = new Group();

    this.light = new DirectionalLight(0xefefff, 1.5); // (0xffffff, 5, 1000, 2);
    this.light.castShadow = true;
    this.light.shadow.mapSize.width = 512; // default
    this.light.shadow.mapSize.height = 512; // default
    this.light.shadow.camera.near = 0.5; // default
    this.light.shadow.camera.far = 800; // default

    // let  that.light = new DirectionalLight( 0xefefff, 1.5 );
    this.light.position.set(-1, -0.197, 0.377).normalize();

    this.ambient = new AmbientLight(0xffffff);
    this.light.position.set(1, 1, 1);
    const directionalLight = new DirectionalLight(0xffefef, 1.5);
    directionalLight.position.set(-1, -1, -1);
    this._scene.add(this.light);
    this._scene.add(directionalLight);

    this.helper = new DirectionalLightHelper(this.light);
    this._scene.add(this.helper);

    this._scene.add(this.ambient);
    this._scene.add(this._geometryText);

    this._renderer = new WebGLRenderer({ antialias: true });
    this._renderer.shadowMap.enabled = true;
    this._renderer.shadowMap.type = PCFSoftShadowMap;

    this._renderer.setClearColor(0xffffff);
    this._renderer.setPixelRatio(window.devicePixelRatio);
    this._renderer.setSize(window.innerWidth, window.innerHeight);
    // this._renderer.sortObjects = false;
    // let planeGeometry = new PlaneBufferGeometry(1000, 1000, 32, 32);
    // let planeMaterial = new MeshStandardMaterial({ color: 0x00ff00 });
    // let plane = new Mesh(planeGeometry, planeMaterial);
    // plane.position.z = -200;
    // plane.receiveShadow = true;
    // plan vert
    // this._scene.add(plane);
    this._container.appendChild(this._renderer.domElement);
    this._controls = new OrbitControls(this._cameraO, this._renderer.domElement);
    window.addEventListener(
      'resize',
      () => {
        this._windowHalfX = window.innerWidth / 2;
        this._windowHalfY = window.innerHeight / 2;

        this._cameraP.aspect = window.innerWidth / window.innerHeight;
        this._cameraP.updateProjectionMatrix();
        // this.updateCamera();

        this._renderer.setSize(window.innerWidth, window.innerHeight);
      },
      false);

    let saveButton = document.createElement('button');
    saveButton.innerHTML = 'sauvegarde';
    let style = saveButton.style;
    style.zIndex = '1000';
    style.position = 'fixed';
    style.bottom = '0px';
    style.left = '0px';
    style.backgroundColor = 'red';
    document.body.appendChild(saveButton);
    saveButton.addEventListener('click', () => this.exporterOBJ());
  }

  /**
   * Export in Wavefront OBJ format.
   * Exported file can be imported in Blender.
   *
   * Two files a generated:
   * * sceneCones.obj
   * * sceneLines.obj
   * @private
   * @memberof BigBoard
   */
 private exporterOBJ(): void {
    let exporter = new OBJExporter();
    alert('Export begins...');
    let groupCone = new Group();
    let groupLineCourt = new Group();
    let groupLineLong = new Group();
    this.coneBoard.coneMeshCollection.forEach(cone => groupCone.add(cone));
    this.coneBoard.lineCollection.forEach(line => {
       if (line.getOpening <  2000 / ( CONFIGURATION.earthRadiusMeters / 1000)) {
            groupLineCourt.add(line);
       } else {
            groupLineLong.add(line);
       }
    });
    let blobCone = new Blob([exporter.parse(groupCone)], { type: 'text/plain;charset=utf-8' });
    save(blobCone, 'sceneCones.obj');
    let blobLineCourt = new Blob([exporter.parse(groupLineCourt)], { type: 'text/plain;charset=utf-8' });
    save(blobLineCourt, 'sceneLinesCourt.obj');
    let blobLineLong = new Blob([exporter.parse(groupLineLong)], { type: 'text/plain;charset=utf-8' });
    save(blobLineLong, 'sceneLinesLong.obj');
    this._scene.add(groupCone);
    this._scene.add(groupLineCourt);
    this._scene.add(groupLineLong);
    alert('Export done');
 }

  /**
   * animate : Animating and displaying the scene every frame
   * @private
   * @memberof BigBoard
   */
  private _animate(): void {
    let scene = this._scene;
    let camera = this.orthographique === true ? this._cameraO : this._cameraP;
    this._controls.object = camera;
    requestAnimationFrame(() => this._animate());
    this._renderer.render(scene, camera);
    this._stats.update();
    this._controls.update();
    TWEEN.update();
    CONFIGURATION.tick();
  }
  /**
   * initInteraction : Initialize GUI
   * @private
   * @memberof BigBoard
   */
  private initInteraction(): void {
    // container, merger
    const gui = new dat.GUI();
    const that = this;
    let conf = {
      coneStep: CONFIGURATION.coneStep * CONFIGURATION.rad2deg,
      year: parseInt(<string>CONFIGURATION.year, 10),
      projection: {
        aucun: 0,
        equirectangulaire: 1,
        Mercator: 2,
        Winkel: 3,
        Eckert: 4,
        'Van Der Grinten': 5,
        'conic equidistant': 6,
      },
      'type de transport': '',
      'couleur cones': '#' + (<any>CONFIGURATION.BASIC_CONE_MATERIAL).color.getHex().toString(16),
      'transparence des cônes': CONFIGURATION.BASIC_CONE_MATERIAL.opacity,
      'couleur des lignes': '#' + CONFIGURATION.BASIC_LINE_MATERIAL.color.getHex().toString(16),
      'couleur du texte': '#' + CONFIGURATION.BASIC_TEXT_MATERIAL.color.getHex().toString(16),
      'transparence des lignes': CONFIGURATION.BASIC_LINE_MATERIAL.opacity,
      'couleur lumière': '#' + that.light.color.getHex().toString(16),
      intensity: that.light.intensity,
      'couleur ambient': '#' + that.ambient.color.getHex().toString(16),
      longitude: CONFIGURATION.referenceEquiRectangular.longitude,
      latitude: CONFIGURATION.referenceEquiRectangular.latitude,
      hauteur: CONFIGURATION.referenceEquiRectangular.height,
      'parallèle standard 1': CONFIGURATION.standardParallel1 * CONFIGURATION.rad2deg,
      'parallèle standard 2': CONFIGURATION.standardParallel2 * CONFIGURATION.rad2deg,
      'with limits': true,
      exportCountry: that.orthographique,
    };

    // light
    let lightFolder = gui.addFolder('lumière');
    lightFolder.add(that.ambient, 'intensity', 0, 5, 0.01).name('intensité ambiante');
    lightFolder.addColor(conf, 'couleur lumière').onChange((v: string) => {
      let color = parseInt(v.replace('#', ''), 16);
      that.light.color.setHex(color);
      that.helper.color = color;
      that.helper.update();
    });
    lightFolder.addColor(conf, 'couleur ambient').onChange((v: string) => {
      let color = parseInt(v.replace('#', ''), 16);
      that.ambient.color.setHex(color);
    });
    lightFolder
      .add(conf, 'intensity', 0, 5, 0.01)
      .name('intensité lumière')
      .onChange((v: number) => {
        that.light.intensity = v;
        that.helper.update();
      });

    lightFolder.add(that.light.position, 'x', -100, 100, 1).onChange(() => that.helper.update());
    lightFolder.add(that.light.position, 'y', -100, 100, 1).onChange(() => that.helper.update());
    lightFolder.add(that.light.position, 'z', -100, 100, 1).onChange(() => that.helper.update());
    lightFolder.add(that.light.shadow.mapSize, 'width', 0, 1000).step(1);
    lightFolder.add(that.light.shadow.mapSize, 'height', 0, 1000).step(1);
    lightFolder.add(that.light.shadow.camera, 'near', 0, 1000).step(0.5);
    lightFolder.add(that.light.shadow.camera, 'far', 0, 1000).step(1);

    // generalities
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
    referenceFolder
      .add(conf, 'parallèle standard 1', -90, 90, 0.1)
      .onChange((v: number) => (CONFIGURATION.standardParallel1 = v * CONFIGURATION.deg2rad));
    referenceFolder
      .add(conf, 'parallèle standard 2', -90, 90, 0.1)
      .onChange((v: number) => (CONFIGURATION.standardParallel2 = v * CONFIGURATION.deg2rad));
    projectionFolder.add(CONFIGURATION, 'projectionInit', conf.projection).name('projection initiale');
    projectionFolder.add(CONFIGURATION, 'projectionEnd', conf.projection).name('projection finale');
    projectionFolder
      .add(CONFIGURATION, 'percentProjection', 0, 100)
      .step(1)
      .name('transition projection');
    let annees = generalFolder.add(conf, 'year', 1930, 2030).step(1);
    annees.onChange((v: string | number) => (CONFIGURATION.year = v));

    // toggle Camera Orthograpgic/Perspectiv View
    let swapView = projectionFolder.add(that, 'orthographique');
    swapView.onChange(() => (that.orthographique = !that.orthographique));
    generalFolder
      .add(that, '_showCitiesName')
      .name('Show Cities name')
      .onChange(() => that.showCitiesName()); // bigboard to parameter

    // cones
    let coneFolder = gui.addFolder('Cones');

    coneFolder
      .add(conf, 'coneStep', 1, 360)
      .step(1)
      .onChange((value: number) => (CONFIGURATION.coneStep = value * CONFIGURATION.deg2rad));
    coneFolder.add(that, 'withLimits').onChange((value: boolean) => (conf['with limits'] = value));
    coneFolder
      .add(that.coneBoard, 'opacity', 0, 1)
      .step(0.01)
      .name('opacité');
    let terresterialFolder = coneFolder.addFolder('configurations spécifiques');
    let terrestrialControllersList: dat.GUI[] = [];
    let flagTransportDone = false;

    // lines
    let aerialFolder = gui.addFolder('Lignes');
    aerialFolder
      .add(CONFIGURATION, 'pointsPerLine', 0, 200)
      .step(1)
      .name('nombre de points');
    let aerialControllersList: dat.GUI[] = [];

    // pays /mise en exergue avec listen?
    // countries / highlight with listen?
    let countryFolder = gui.addFolder('pays');
    countryFolder.add(that.countryBoard, 'show');
    countryFolder
      .add(that.countryBoard, 'opacity', 0, 1)
      .step(0.01)
      .name('opacité');
    countryFolder.add(that.countryBoard, 'extruded', -100, 100).step(1);
    countryFolder
      .add(conf, 'exportCountry')
      .name('Export avec continent')
      .onChange(() => (that.orthographique = !that.orthographique));
    let countryControllersList: dat.GUI[] = [];
    DragnDrop(
      that._container,
      list => {
        // container en paramètre
        if (_filesData.length === 0) {
          that.countryBoard.ready = false;
        }
        _filesData.push(...list);
        let json: string;
        _filesData.forEach(item => {
          let name = item.name.toLowerCase();
          if (name.endsWith('.geojson')) {
            json = item.text;
          } else if (name.endsWith('.csv')) {
            that._merger.add(item.text);
            if (that.state === 'ready') {
              that._merger.merge();
            }
          }
        });
        Promise.all([
          new Promise(resolve => {
            if (that.countryBoard.ready === false && json !== undefined) {
              that.countryBoard.add(JSON.parse(json)).then(() => {
                while (countryControllersList.length > 0) {
                  let subGui = countryControllersList.pop();
                  countryFolder.removeFolder(subGui);
                }
                let synonymes: string[] = [];
                that.countryBoard.countryMeshCollection
                  .sort((a, b) => a.mainName.localeCompare(b.mainName))
                  .forEach(country => {
                    let countryName = country.mainName;
                    let i = -1;
                    while (synonymes.indexOf(countryName) > -1) {
                      i++;
                      countryName = country.mainName + i;
                    }
                    synonymes.push(countryName);
                    let folder = countryFolder.addFolder(countryName);
                    folder
                      .add(country, 'extruded', -100, 100)
                      .step(1)
                      .listen();
                    folder.add(country, 'visible').listen();
                    folder
                      .add(country.material, 'opacity', 0, 1)
                      .step(0.01)
                      .listen();
                    countryControllersList.push(folder);
                  });
                resolve();
              });
            } else {
              resolve();
            }
          }),
          new Promise(resolve => {
            if (that.state === 'complete' && flagTransportDone === false) {
              flagTransportDone = true;
              while (terrestrialControllersList.length > 0) {
                let subGui = terrestrialControllersList.pop();
                terresterialFolder.removeFolder(subGui);
              }
              that._merger.transportNames.cones.forEach(transportName => {
                let folder = terresterialFolder.addFolder(transportName);
                terrestrialControllersList.push(folder);
                function colorListener(): void {
                  let opacity = <number>coneOpacity.getValue();
                  let color = parseInt(coneColor.getValue().replace('#', ''), 16);
                  let limits = <boolean>coneLimits.getValue();
                  that.coneBoard.coneMeshCollection
                    .filter(cone => transportName === cone.transportName)
                    .forEach(cone => {
                      let material = <MeshPhongMaterial>cone.material;
                      material.color.setHex(color);
                      material.opacity = opacity;
                      cone.withLimits = limits;
                    });
                }
                let coneColor = folder.addColor(conf, 'couleur cones').name('couleur');
                coneColor.onChange(colorListener);
                let coneOpacity = folder
                  .add(conf, 'transparence des cônes', 0, 1, 0.01)
                  .name('transparence');
                coneOpacity.onChange(colorListener);
                let coneLimits = folder.add(conf, 'with limits').listen();
                coneLimits.onChange(colorListener);
              });

              while (aerialControllersList.length > 0) {
                let subGui = aerialControllersList.pop();
                aerialFolder.removeFolder(subGui);
              }
              that._merger.transportNames.lines.forEach(transportName => {
                let folder = aerialFolder.addFolder(transportName);
                aerialControllersList.push(folder);
                function lineListener(): void {
                  let opacity = <number>lineOpacity.getValue();
                  let color = parseInt(lineColor.getValue().replace('#', ''), 16);
                  that.coneBoard.lineCollection
                    .filter(line => transportName === line.transportName)
                    .forEach(line => {
                      let material = <LineBasicMaterial>line.material;
                      material.color.setHex(color);
                      material.opacity = opacity;
                    });
                }
                let lineColor = folder.addColor(conf, 'couleur des lignes').name('couleur');
                lineColor.onChange(lineListener);
                let lineOpacity = folder
                  .add(conf, 'transparence des lignes', 0, 1, 0.01)
                  .name('transparence');
                lineOpacity.onChange(lineListener);
              });
            }
            resolve();
          }),
        ]).then(() => {
          if (that.countryBoard.ready === true && that.state === 'complete') {
            flagTransportDone = false;
            annees
              .min(that._merger.minYear)
              .max(that._merger.maxYear)
              .updateDisplay();
            that.coneBoard.add(that._merger.datas);
            // this._merger.clear();
            let sizeText = generalFolder
              .add(that, '_sizetext', 0, 2)
              .name('taille du texte')
              .step(0.1);
            sizeText.onChange(() => that.rescaleText());
            generalFolder.addColor(conf, 'couleur du texte').onChange((v: string) => {
              let color = parseInt(v.replace('#', ''), 16);
              CONFIGURATION.BASIC_TEXT_MATERIAL.color.setHex(color);
              that.updateCityName();
            });
            _filesData = [];
          }
        });
      },
      that);
  }
}
