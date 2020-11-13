'use strict';
import { CONFIGURATION } from '../common/configuration';
import {
	PerspectiveCamera,
	Scene,
	WebGLRenderer,
	DirectionalLight,
	Fog,
	AmbientLight,
	Mesh,
	PCFSoftShadowMap,
	DirectionalLightHelper,
	Group,
	OrthographicCamera,
	TextGeometry,
	Vector3,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter';
import Stats from 'three/examples/js/libs/stats.min';
import { prepareConfiguration } from './initThree';
import { ConeBoard } from '../cone/coneBoard';
import { CountryBoard } from '../country/countryBoard';
import { Merger } from './merger';
import type { IMergerState, ISumUpCriteria, ILookupCurvesAndCityGraph, ICriterias } from '../definitions/project';
import { saveAs } from 'file-saver';
import type { PseudoCone } from '../cone/base';
import type { CountryMeshShader } from '../country/countryMeshShader';
import { GUI } from './guiDAT';
import jszip from 'jszip/dist/jszip';
import type * as GeoJSON from 'geojson';
import type { IListFile } from '../definitions/project';

/**
 * C'est la classe qui contrôle toute l'application: la liste des cônes, pays et
 * courbes ainsi que la scene THREE.JS + les commandes et le comportement...
 *
 * This class controls all the application:
 * * the list of [[_cones]],
 * * [[_countries]],
 * * curves
 * This is where the THREE.JS scene is defined with commands and behaviors
 */
export default class BigBoard {
	/**
	 * La configuration de l'application accessible en statique!
	 *
	 * the configuration of the app, available in static
	 */
	public static configuration = CONFIGURATION;
	public helper: DirectionalLightHelper;
	public light: DirectionalLight;
	public ambient: AmbientLight;
	/**
	 * Ensemble des cônes (un cône correspond à une ville et un mode de transport)
	 *
	 * set of cones: a [[_cone]] corresponds to a city and a mode of terrestrial transport
	 */
	public coneBoard: ConeBoard;
	/**
	 * Liste des pays générés depuis un fichier geojson
	 *
	 * list of countries generated from a geojson file
	 */
	public countryBoard: CountryBoard;
	// Is orthographic camera
	public orthographique: boolean;
	private _stats: any;
	private _controls: OrbitControls;

	private _cameraO: OrthographicCamera;
	private _cameraP: PerspectiveCamera;
	private _showCitiesName: boolean;
	private _populations: number;
	private _sizetext: number;
	private _scene: Scene;
	private _renderer: WebGLRenderer;
	private _windowHalfX: number = window.innerWidth / 2;
	private _windowHalfY: number = window.innerHeight / 2;
	private _merger: Merger;
	private _gui: GUI;

	// Noeud ajout nom Ville
	private _geometryText: Group;

	/**
	 * Creates an instance of bigBoard
	 *
	 * GUI is linked to bigBoard (but not contained in)
	 */
	constructor(element: HTMLElement, dat: HTMLElement) {
		void prepareConfiguration().then(() => {
			this._merger = new Merger();
			this._init(element);
			this.orthographique = true;

			this.countryBoard = new CountryBoard(this._scene, this._cameraO);
			this.countryBoard.show = false;
			this.coneBoard = new ConeBoard(this._scene, this._cameraO, this.countryBoard, this._renderer);
			CONFIGURATION.year = '2010';
			this._showCitiesName = false;

			this._gui = new GUI(this, dat, this._merger);
			this._animate();
		});
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

	public addCountries(geoJson: GeoJSON.FeatureCollection): void {
		void this.countryBoard.add(geoJson);
	}

	/**
	 * @see coneBoard :  cleanCones method
	 * @memberof BigBoard
	 */
	public cleanCones(): void {
		this.coneBoard.clean();
	}

	public cleanAll(list: IListFile[]): void {
		this.cleanCones();
		this.cleanCountries();
		this._merger.clear();
		this._gui.filesToInsert(list);
	}

	/**
	 * Add cone to the coneMeshCollection
	 * @todo unused and irrelevant @see coneBoard.add
	 * @param {ILookupCurvesAndCityGraph} lookup
	 * @memberof BigBoard
	 */
	public addCones(lookup: ILookupCurvesAndCityGraph): void {
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
	public getCountryByMouse(event: MouseEvent, highLight = false): CountryMeshShader {
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
	public getConeByMouse(event: MouseEvent, highLight = false): PseudoCone {
		return this.coneBoard.getMeshByMouse(event, highLight);
	}

	/**
	 * Highlith countries @see contryBoard.highLight
	 * @todo unused and irrelevant @see contryBoard.highLight
	 * @param {ICriterias} criterias
	 * @param {boolean} [light=true]
	 * @memberof BigBoard
	 */
	public highLightCountries(criterias: ICriterias, light = true): void {
		this.countryBoard.highLight(criterias, light);
	}

	/**
	 * Highlight cones @see coneBoard.highLight
	 * @todo unused and irrelevant @see coneBoard.highLight
	 * @param {ICriterias} criterias
	 * @param {boolean} [light=true]
	 * @memberof BigBoard
	 */
	public highLightCones(criterias: ICriterias, light = true): void {
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
		if (this.countryBoard.show) {
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
		if (this.coneBoard.show) {
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
		if (this._showCitiesName) {
			this.updateCityName();
		} else {
			for (let i = this._geometryText.children.length - 1; i >= 0; i--) {
				this._geometryText.remove(this._geometryText.children[i]);
			}
		}
	}

	/**
	 * Rescale all text by the sizetexte p
	 * @memberof BigBoard
	 */
	public rescaleText(): void {
		for (let i = this._geometryText.children.length - 1; i >= 0; i--) {
			this._geometryText.children[i].scale.set(this._sizetext, this._sizetext, this._sizetext);
		}
	}

	/**
	 * Update all the city which will be displayed regarding the population threshold paramater
	 */
	public updateCityName(): void {
		if (this._merger.state !== 'complete') {
			return;
		}

		let mesh: Mesh;
		for (let i = this._geometryText.children.length - 1; i >= 0; i--) {
			this._geometryText.remove(this._geometryText.children[i]);
		}

		for (let j = 0; j < this.getMergerI.Cities.length / 2; j++) {
			const obj = JSON.parse(JSON.stringify(this.getMergerI.Cities[j]));
			const pop = JSON.parse(
				JSON.stringify(
					this._merger.edgesWithTranspModes.lookupCityNetwork[this.getMergerI.Cities[j].cityCode]
						.origCityProperties.populations
				)
			);
			const population = pop.pop2020;
			if (population > this._populations) {
				const geometry = new TextGeometry(obj.urbanAgglomeration, CONFIGURATION.TEXT_GEOMETRY_OPTIONS);
				mesh = new Mesh(geometry, CONFIGURATION.BASIC_TEXT_MATERIAL);
				const cart = this._merger.edgesWithTranspModes.lookupCityNetwork[this.getMergerI.Cities[j].cityCode]
					.referential.cartoRef;
				const x =
					-CONFIGURATION.THREE_EARTH_RADIUS * 1.1 * Math.cos(cart.latitude * 0.95) * Math.cos(cart.longitude);
				const y = CONFIGURATION.THREE_EARTH_RADIUS * 1.1 * Math.sin(cart.latitude * 0.95);
				const z =
					CONFIGURATION.THREE_EARTH_RADIUS * 1.1 * Math.cos(cart.latitude * 0.95) * Math.sin(cart.longitude);
				this._geometryText.add(mesh);
				mesh.position.set(x, y, z);
				mesh.lookAt(new Vector3(x * 2, y * 2, z * 2));

				// Mesh.rotation.set(0,Math.cos(cart.latitude*CONFIGURATION.rad2deg),0);
			}
		}

		this.rescaleText();
	}

	/**
	 * Initalize the scene
	 * @private
	 * @memberof BigBoard
	 */
	private _init(element: HTMLElement): HTMLDivElement {
		const container = document.createElement('div');
		element.appendChild(container);
		this._stats = new Stats();
		this._stats.domElement.style.position = 'absolute';
		this._stats.domElement.style.top = '0px';
		this._stats.domElement.style.zIndex = 100;
		container.appendChild(this._stats.domElement);
		this._cameraP = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 15000);
		this._cameraO = new OrthographicCamera(
			-this._windowHalfX,
			this._windowHalfX,
			this._windowHalfY,
			-this._windowHalfY,
			1,
			2000
		);
		this._cameraO.position.set(0, 0, 500);
		this._cameraP.position.set(0, 0, 500);
		this._populations = 0;
		this._sizetext = 1;
		this._scene = new Scene();
		this._scene.add(this._cameraO);
		this._scene.add(this._cameraP);

		this._cameraO.lookAt(this._scene.position);
		this._cameraP.lookAt(this._scene.position);
		this._scene.fog = new Fog(0x000000, 1, 15000);
		this._geometryText = new Group();

		this.light = new DirectionalLight(0xefefff, 0); // (0xffffff, 5, 1000, 2);
		this.light.castShadow = true;
		this.light.shadow.mapSize.width = 512; // Default
		this.light.shadow.mapSize.height = 512; // Default
		this.light.shadow.camera.near = 0.5; // Default
		this.light.shadow.camera.far = 800; // Default

		// let  that.light = new DirectionalLight( 0xefefff, 1.5 );
		this.light.position.set(-1, -0.197, 0.377).normalize();

		this.ambient = new AmbientLight(0xffffff, 0);
		this.light.position.set(1, 1, 1);
		const directionalLight = new DirectionalLight(0xffefef, 0);
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
		// This._renderer.sortObjects = false;
		// let planeGeometry = new PlaneBufferGeometry(1000, 1000, 32, 32);
		// let planeMaterial = new MeshStandardMaterial({ color: 0x00ff00 });
		// let plane = new Mesh(planeGeometry, planeMaterial);
		// plane.position.z = -200;
		// plane.receiveShadow = true;
		// plan vert
		// this._scene.add(plane);
		container.append(this._renderer.domElement);
		this._controls = new OrbitControls(this._cameraO, this._renderer.domElement);
		window.addEventListener(
			'resize',
			() => {
				if (this.orthographique) {
					this._cameraO.left = -window.innerWidth / 2;
					this._cameraO.right = window.innerWidth / 2;
					this._cameraO.top = window.innerHeight / 2;
					this._cameraO.bottom = -window.innerHeight / 2;
					this._cameraO.updateProjectionMatrix();
				} else {
					this._windowHalfX = window.innerWidth / 2;
					this._windowHalfY = window.innerHeight / 2;
					this._cameraP.aspect = window.innerWidth / window.innerHeight;
					this._cameraP.updateProjectionMatrix();
				}

				this._renderer.setSize(window.innerWidth, window.innerHeight);
			},
			false
		);

		const saveButton = document.createElement('button');
		saveButton.innerHTML = 'Save scene';
		const style = saveButton.style;
		style.zIndex = '1000';
		style.position = 'fixed';
		style.bottom = '0px';
		style.left = '0px';
		style.backgroundColor = 'red';
		element.append(saveButton);
		saveButton.addEventListener('click', () => this.exporterOBJ());
		return container;
	}

	/**
	 * Export the scene in Wavefront OBJ format.
	 * Exported files can be imported in Blender.
	 *
	 * Three files are generated:
	 * * sceneCones.obj
	 * * sceneCurvesLongHaul.obj for short distance flights above the geodesic
	 * * sceneCurvesShortHaul.obj for long distance geodesic flights
	 * @private
	 * @memberof BigBoard
	 */
	public exporterOBJ(): void {
		const exporter = new OBJExporter();
		const groupCone = new Group();
		const groupCurveShortHaul = new Group();
		const groupCurvesLongHaul = new Group();
		this.coneBoard.coneMeshCollection.forEach((cone) => groupCone.add(cone));
		this.coneBoard.curveCollection.forEach((curve) => {
			if (curve.getTheta < 2000 / (CONFIGURATION.earthRadiusMeters / 1000)) {
				groupCurveShortHaul.add(curve);
			} else {
				groupCurvesLongHaul.add(curve);
			}
		});
		const blobCone = new Blob([exporter.parse(groupCone)], {
			type: 'text/plain;charset=utf-8',
		});
		const blobCurveShort = new Blob([exporter.parse(groupCurveShortHaul)], {
			type: 'text/plain;charset=utf-8',
		});
		const blobCurveLong = new Blob([exporter.parse(groupCurvesLongHaul)], {
			type: 'text/plain;charset=utf-8',
		});
		const zip = new jszip();
		zip.file('sceneCones.obj', blobCone);
		zip.file('sceneCurvesShortHaul.obj', blobCurveShort);
		zip.file('sceneCurvesLongHaul.obj', blobCurveLong);
		zip.generateAsync({ type: 'blob' }).then(function (content) {
			saveAs(content, 'scene.zip');
		});
		// this._scene.add(groupCone);
		// this._scene.add(groupCurveShortHaul);
		// this._scene.add(groupCurvesLongHaul);
	}

	/**
	 * Animate : Animating and displaying the scene every frame
	 * @private
	 * @memberof BigBoard
	 */
	private _animate(): void {
		const scene = this._scene;
		const camera = this.orthographique ? this._cameraO : this._cameraP;
		this._controls.object = camera;
		requestAnimationFrame(() => this._animate());
		this._renderer.render(scene, camera);
		this._stats.update();
		this._controls.update();
		CONFIGURATION.tick();
	}
}
