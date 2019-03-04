'use strict';
import { CONFIGURATION } from '../common/configuration';
import {
  MeshBasicMaterial, DoubleSide, MeshPhongMaterial, PerspectiveCamera, MeshStandardMaterial,
  OrbitControls, Scene, WebGLRenderer, DirectionalLight, Fog,
  AmbientLight, Mesh, LineBasicMaterial, PCFSoftShadowMap, PlaneBufferGeometry,
  DirectionalLightHelper, Group, OrthographicCamera,
  FontLoader, TextGeometry, TextureLoader, Font, Vector3,
} from 'three';
import { OBJExporter } from '../../node_modules/three-obj-exporter-t/OBJExporter';
import { ConeBoard } from '../cone/coneBoard';
import { CountryBoard } from '../country/countryBoard';
import { Merger } from './merger';
import { DragnDrop } from '../common/utils';
import {
  IMergerState, ISumUpCriteria, ILookupAndMaxSpeedAndLine, ICriterias,
  IListFile,
} from '../definitions/project';
import { PseudoCone } from '../cone/base';
import { CountryMeshShader } from '../country/countryMeshShader';
import * as dat from 'dat.gui';

declare let Stats: any;
let option: any;
/**
 * initialise les données de ThreeJS pour l'application (textures, couleurs...)
 *
 * initialising the threejs data of the application (textures, colors, ect.)
 */
function prepareConfiguration(): void {
  if (CONFIGURATION.COUNTRY_MATERIAL === undefined) {
    CONFIGURATION.highLitedMaterial = new MeshBasicMaterial(
      { color: 0xffff00, transparent: true, opacity: 0.5, side: DoubleSide });
    let earthMaterial = new MeshBasicMaterial({
      opacity: 0.8, depthTest: true, depthWrite: true, side: DoubleSide, transparent: true,
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
      color: 0x1000ff, linewidth: .5, side: DoubleSide, transparent: true, opacity: 0.3,
    });
  }

}
let _filesData: IListFile[] = [];
let _light = new DirectionalLight(0xefefff, 1.5); // (0xffffff, 5, 1000, 2);
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
// function exportGLTF(input: any): void {
//     let _gltfExporter = new GLTFExporter();
//     let options = {
//         trs: true, // document.getElementById('option_trs').checked,
//         onlyVisible: true, // document.getElementById('option_visible').checked,
//         // truncateDrawRange: true, // document.getElementById('option_drawrange').checked,
//         // binary: true, // document.getElementById('option_binary').checked,
//         // forceIndices: false, // document.getElementById('option_forceindices').checked,
//         // forcePowerOfTwoTextures: false, // document.getElementById('option_forcepot').checked,
//     };
//     _gltfExporter.parse(
//         input, (result) => {
//             if (result instanceof ArrayBuffer) {
//                 saveArrayBuffer(result, 'scene.glb');
//             } else {
//                 let output = JSON.stringify(result, null, 2);
//                 console.log(output);
//                 saveString(output, 'scene.gltf');
//             }
//         },
//         options);
// }

let link = document.createElement('a');
/**
 * fonction de sauvegarde de données par le navigateur internet
 * function to save the data through the browser
 * @param blob     tableau de données au format blob
 * @param filename le nom de sauvegarde du tableau de données (l'emplacement est à la main de l'utilisateur)
 */
function save(blob: any, filename: string): void {
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}
// function saveString(text: string, filename: string): void {
//     save(new Blob([text], { type: 'text/plain' }), filename);
// }
// function saveArrayBuffer(buffer: ArrayBuffer, filename: string): void {
//     save(new Blob([buffer], { type: 'application/octet-stream' }), filename);
// }

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
  private _cones: ConeBoard;
  /**
   * liste des pays générés depuis un fichier geojson
   * List of countries generated from a geojson file
   */
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
  private _populations: number;
  private _sizetext: number;
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
    this.loaderFont.load('gentilis_regular.typeface.json', function(font: Font): void {
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
   * @type {number}
   * @memberof BigBoard
   */
  get scaleCountries(): number {
    return this._countries.scale;
  }
  /**
   * Setter : Update the value of scale parameter
   * @param {number} value
   * @memberof BigBoard
   */
  set scaleCountries(value: number) {
    this._countries.scale = value;
  }

  /**
   * Getter : Get scale parameter of the cones parameter
   * @type {number}
   * @memberof BigBoard
   */
  get scaleCones(): number {
    return this._cones.scale;
  }

  /**
   * Setter : Update the value of scale parameter
   * @param {number} value
   * @memberof BigBoard
   */
  set scaleCones(value: number) {
    this._cones.scale = value;
  }

  /**
   * Getter: Get show parameter of contries paramter
   * @type {boolean}
   * @memberof BigBoard
   */
  get showCountries(): boolean {
    return this._countries.show;
  }
  /**
   * Setter : Update the value of show paramater of contries parameter
   * @memberof BigBoard
   */
  set showCountries(value: boolean) {
    this._countries.show = value;
  }

  /**
   * Getter: Get show parameter of cone paramter
   * @type {boolean}
   * @memberof BigBoard
   */
  get showCones(): boolean {
    return this._cones.show;
  }
  /**
   * Setter : Update the value of show paramater of cones paramater
   * @param {boolean} value
   * @memberof BigBoard
   */
  set showCones(value: boolean) {
    this._cones.show = value;
  }
  get lookupCountries(): ISumUpCriteria {
    return this._countries.lookupCriterias;
  }
  get lookupCones(): ISumUpCriteria {
    return this._cones.lookupCriterias;
  }

  /**
   * Getter : Get if the boundaries of the cones is limited by the contries
   * @type {boolean}
   * @memberof BigBoard
   */
  get withLimits(): boolean {
    return this._cones.withLimits;
  }
  /**
   * Setter : update the withlimits paramater of the cones paramater
   * if true the boundaries of cones will be limited by the boundaries of contries
   * @memberof BigBoard
   */
  set withLimits(value: boolean) {
    this._cones.withLimits = value;
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
   * @see contryBoard  : cleanContries method
   * @memberof BigBoard
   */
  public cleanCountries(): void {
    this._countries.clean();
  }

  public addCountries(geoJson: any): void {
    this._countries.add(geoJson);
  }
  /**
   * @see coneBoard :  cleanCones method
   * @memberof BigBoard
   */
  public cleanCones(): void {
    this._cones.clean();
  }

  /**
   * Add cone to the coneMeshCollection
   * @todo unused and irrelevant @see coneBoard.add
   * @param {ILookupAndMaxSpeedAndLine} lookup
   * @memberof BigBoard
   */
  public addCones(lookup: ILookupAndMaxSpeedAndLine): void {
    this._cones.add(lookup, CONFIGURATION.extrudedHeight);
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
    return this._countries.getMeshByMouse(event, highLight);
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
    return this._cones.getMeshByMouse(event, highLight);
  }

  /**
   * Highlith contries @see contryBoard.highLight
   * @todo unused and irrelevant @see contryBoard.highLight
   * @param {ICriterias} criterias
   * @param {boolean} [light=true]
   * @memberof BigBoard
   */
  public highLightCountries(criterias: ICriterias, light: boolean = true): void {
    this._countries.highLight(criterias, light);
  }

  /**
   * Highlight cones @see coneBoard.highLight
   * @todo unused and irrelevant @see coneBoard.highLight
   * @param {ICriterias} criterias
   * @param {boolean} [light=true]
   * @memberof BigBoard
   */
  public highLightCones(criterias: ICriterias, light: boolean = true): void {
    this._cones.highLight(criterias, light);
  }

  /**
   * Update the withlimit paramter value of all cones in the coneMeshCollection
   * @todo unused and irrelevant @see coneBoard.setLimits
   * @param {ICriterias} criterias
   * @param {boolean} limit
   * @memberof BigBoard
   */
  public setLimits(criterias: ICriterias, limit: boolean): void {
    this._cones.setLimits(criterias, limit);
  }

  /**
   * Show/Hide a contryMeshCollection
   * @todo unused and irrelevant @see contryBoard.showCriterias
   * @param {ICriterias} criterias
   * @param {boolean} state
   * @memberof BigBoard
   */
  public showCountriesCriterias(criterias: ICriterias, state: boolean): void {
    this._countries.showCriterias(criterias, state);
  }

  /**
   * Show/Hide a coneMeshCollection
   * @todo unused and irrelevant @see contryBoard.showCriterias
   * @param {ICriterias} criterias
   * @param {boolean} state
   * @memberof BigBoard
   */
  public showConesCriterias(criterias: ICriterias, state: boolean): void {
    this._cones.showCriterias(criterias, state);
  }

  /**
   * Get a contryMeshCollection with all contries verifying 'criterias'
 * @param {ICriterias} criterias
   * @returns {CountryMeshShader[]}
   * @memberof BigBoard
   */
  public getCountries(criterias: ICriterias): CountryMeshShader[] {
    let resultat: CountryMeshShader[] = [];
    if (this._countries.show === true) {
      resultat = this._countries.searchMesh(criterias);
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
    if (this._cones.show === true) {
      resultat = this._cones.searchMesh(criterias);
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
    this._countries.extrude(criterias, value);
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
      this.updateCityName(option);
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
   * Update all the cities which will be displayed
   * considering the populuation threeshold parameter
   *
   * @param {*} [option]
   * @returns {void}
   * @memberof BigBoard
   */
  public updateCityName(option?: any): void {
    if (this._merger.state !== 'complete') {
      return;
    }
    let mesh: Mesh;
    for (var i = this._geometryText.children.length - 1; i >= 0; i--) {
      this._geometryText.remove(this._geometryText.children[i]);
    }
    for (var j = 0; j < this.getMergerI.Cities.length / 2; j++) {
      var obj = JSON.parse(JSON.stringify(this.getMergerI.Cities[j]));
      var pop = JSON.parse(JSON.stringify(
        this._merger.mergedData.lookupCityTransport[this.getMergerI.Cities[j].cityCode]
          .cityProperties.populations));
      var population = pop.pop2020;
      if (population > this._populations) {
        var geometry = new TextGeometry(obj.urbanAgglomeration, option);
        mesh = new Mesh(geometry, CONFIGURATION.BASIC_TEXT_MATERIAL);
        let cart = this._merger.mergedData.lookupCityTransport[this.getMergerI.Cities[j].cityCode].referential.cartoRef;
        let x = - CONFIGURATION.THREE_EARTH_RADIUS * 1.1 * Math.cos(cart.latitude * 0.95) * Math.cos(cart.longitude);
        let y = CONFIGURATION.THREE_EARTH_RADIUS * 1.1 * Math.sin(cart.latitude * 0.95);
        let z = CONFIGURATION.THREE_EARTH_RADIUS * 1.1 * Math.cos(cart.latitude * 0.95) * Math.sin(cart.longitude);
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
      -this._windowHalfX, this._windowHalfX, this._windowHalfY, -this._windowHalfY, 1, 2000);
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

    _light.position.set(1, 1, 1);
    _light2.position.set(-1, -1, -1);
    this._scene.add(_light);
    this._scene.add(_light2);

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

  /**
   * Export in Wavefront OBJ format.
   * Exported file can be imported in Blender.
   * @private
   * @memberof BigBoard
   */
  private exporterOBJ(): void {
    let exporter = new OBJExporter();
    alert('Export begins...');
    let group = new Group();
    // for (var i = 0; i < this._countries.countryMeshCollection.length; ++i) {
    //     var cloned = this._countries.countryMeshCollection[i];
    //     group.add(cloned);
    // }
    for (let j = 0; j < this._cones.coneMeshCollection.length; ++j) {
      var clonedCone = this._cones.coneMeshCollection[j];
      var clonedLine = this._cones.lineCollection[j];
      group.add(clonedCone);
      group.add(clonedLine);
    }
    let blob = new Blob([exporter.parse(group)], { type: 'text/plain;charset=utf-8' });
    save(blob, 'scene.obj');
    this._scene.add(group);
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
    const gui = new dat.GUI();
    let conf = {
      coneStep: CONFIGURATION.coneStep * CONFIGURATION.rad2deg,
      year: parseInt(<string>CONFIGURATION.year, 10),
      projection: {
        aucun: 0, equirectangulaire: 1, Mercator: 2, Winkel: 3, Eckert: 4,
        'Van Der Grinten': 5, 'conic equidistant': 6,
      },
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
      'exportCountry': this.orthographique,
    };

    let that = this;
    // light
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
      this._helper.update();

    });

    lightFolder.add(_light.position, 'x', -100, 100, 1).onChange(() => this._helper.update());
    lightFolder.add(_light.position, 'y', -100, 100, 1).onChange(() => this._helper.update());
    lightFolder.add(_light.position, 'z', -100, 100, 1).onChange(() => this._helper.update());
    lightFolder.add(_light.shadow.mapSize, 'width', 0, 1000).step(1);
    lightFolder.add(_light.shadow.mapSize, 'height', 0, 1000).step(1);
    lightFolder.add(_light.shadow.camera, 'near', 0, 1000).step(0.5);
    lightFolder.add(_light.shadow.camera, 'far', 0, 1000).step(1);

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
    let swapView = projectionFolder.add(this, 'orthographique');
    swapView.onChange(() => this.orthographique = !this.orthographique);
    generalFolder.add(this, '_showCitiesName').name('Show Cities name').onChange(this.showCitiesName.bind(this));

    // cones
    let coneFolder = gui.addFolder('Cones');

    coneFolder.add(conf, 'coneStep', 1, 360).step(1).
      onChange(value => CONFIGURATION.coneStep = value * CONFIGURATION.deg2rad);
    coneFolder.add(this, 'withLimits').onChange(value => conf['with limits'] = value);
    coneFolder.add(this._cones, 'opacity', 0, 1).step(0.01).name('opacité');
    let terresterialFolder = coneFolder.addFolder('configurations spécifiques');
    let terrestrialControllersList: dat.GUI[] = [];
    let flagTransportDone = false;

    // lines
    let aerialFolder = gui.addFolder('Lignes');
    aerialFolder.add(CONFIGURATION, 'pointsPerLine', 0, 200).step(1).name('nombre de points');
    let aerialControllersList: dat.GUI[] = [];

    // pays /mise en exergue avec listen?
    // countries / highlight with listen?
    let countryFolder = gui.addFolder('pays');
    countryFolder.add(this._countries, 'show');
    countryFolder.add(this._countries, 'opacity', 0, 1).step(0.01).name('opacité');
    countryFolder.add(this._countries, 'extruded', -100, 100).step(1);
    countryFolder.add(conf, 'exportCountry').name('Export avec continent').onChange(() => this.orthographique = !this.orthographique);
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
              let sizeText = generalFolder.add(this, '_sizetext', 0, 2).name('taille du texte').step(0.1);
              sizeText.onChange(this.rescaleText.bind(this));
              generalFolder.addColor(conf, 'couleur du texte').onChange(v => {
                let color = parseInt(v.replace('#', ''), 16);
                CONFIGURATION.BASIC_TEXT_MATERIAL.color.setHex(color);
                this.updateCityName.bind(this, option);
              });
              _filesData = [];

            }
          });
      },
      this);
  }
}
