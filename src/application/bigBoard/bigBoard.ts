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
import type { IMergerState, ISumUpCriteria, ILookupCurvesAndCityGraph, ICriteria } from '../definitions/project';
import { saveAs } from 'file-saver';
import type { PseudoCone } from '../cone/base';
import type { CountryMeshShader } from '../country/countryMeshShader';
import { GUI } from './guiDAT';
import jszip from 'jszip/dist/jszip';
import type * as GeoJSON from 'geojson';
import type { IListFile } from '../definitions/project';
import Moveable from 'moveable';

/**
 * This class controls all the application:
 * * the list of [[_cones]],
 * * [[_countries]],
 * * curves
 * This is where the THREE.JS scene is defined with commands and behaviors
 */
export default class BigBoard {
	/**
	 * the configuration of the app, available in static
	 */
	public static configuration = CONFIGURATION;
	public helper: DirectionalLightHelper;
	public light: DirectionalLight;
	public ambient: AmbientLight;
	/**
	 * set of cones: a [[_cone]] corresponds to a city and a mode of terrestrial transport
	 */
	public coneBoard: ConeBoard;
	/**
	 * list of countries generated from a geojson file
	 */
	public countryBoard: CountryBoard;
	// Is orthographic camera
	public orthographic: boolean;
	private _stats: any;
	private _controls: OrbitControls;

	private _cameraO: OrthographicCamera;
	private _cameraP: PerspectiveCamera;
	private _showCitiesName: boolean;
	private _populations: number;
	private _sizeText: number;
	private _scene: Scene;
	private _renderer: WebGLRenderer;
	private _windowHalfX: number = window.innerWidth / 2;
	private _windowHalfY: number = window.innerHeight / 2;
	private _merger: Merger;
	private _gui: GUI;

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
			this.orthographic = true;

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
	 * Enable/Disable showCitiesName parameter in order to show/hide
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
	 * Getter : Get scale parameter of the countries parameter
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
	 * Getter: Get show parameter of countries paramter
	 * @type {boolean}
	 * @memberof BigBoard
	 */
	get showCountries(): boolean {
		return this.countryBoard.show;
	}

	/**
	 * Setter : Update the value of show parameter of countries parameter
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
	 * Setter : Update the value of show parameter of cones parameter
	 * @param {boolean} value
	 * @memberof BigBoard
	 */
	set showCones(value: boolean) {
		this.coneBoard.show = value;
	}

	get lookupCountries(): ISumUpCriteria {
		return this.countryBoard.lookupCriteria;
	}

	get lookupCones(): ISumUpCriteria {
		return this.coneBoard.lookupCriteria;
	}

	/**
	 * Getter : Get if the boundaries of the cones is limited by the countries
	 * @type {boolean}
	 * @memberof BigBoard
	 */
	get withLimits(): boolean {
		return this.coneBoard.withLimits;
	}

	/**
	 * Setter : update the withLimits parameter of the cones parameters
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
	 * @see countryBoard  : cleanCountries method
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
		this.addLegend();
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
	 * Get the country through the position of the mouse
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
	 * @todo unused and irrelevant @see countryBoard.getMeshByMouse
	 * @param {MouseEvent} event
	 * @param {boolean} [highLight=false]
	 * @returns {PseudoCone}
	 * @memberof BigBoard
	 */
	public getConeByMouse(event: MouseEvent, highLight = false): PseudoCone {
		return this.coneBoard.getMeshByMouse(event, highLight);
	}

	/**
	 * Highlight countries @see countryBoard.highLight
	 * @todo unused and irrelevant @see countryBoard.highLight
	 * @param {ICriteria} criteria
	 * @param {boolean} [light=true]
	 * @memberof BigBoard
	 */
	public highLightCountries(criteria: ICriteria, light = true): void {
		this.countryBoard.highLight(criteria, light);
	}

	/**
	 * Highlight cones @see coneBoard.highLight
	 * @todo unused and irrelevant @see coneBoard.highLight
	 * @param {ICriteria} criteria
	 * @param {boolean} [light=true]
	 * @memberof BigBoard
	 */
	public highLightCones(criteria: ICriteria, light = true): void {
		this.coneBoard.highLight(criteria, light);
	}

	/**
	 * Update the withLimit parameter value of all cones in the [[coneMeshCollection]]
	 * @todo unused and irrelevant @see coneBoard.setLimits
	 * @param {ICriteria} criteria
	 * @param {boolean} limit
	 * @memberof BigBoard
	 */
	public setLimits(criteria: ICriteria, limit: boolean): void {
		this.coneBoard.setLimits(criteria, limit);
	}

	/**
	 * Show/Hide a countryMeshCollection
	 * @todo unused and irrelevant @see countryBoard.showCriteria
	 * @param {ICriteria} criteria
	 * @param {boolean} state
	 * @memberof BigBoard
	 */
	public showCountriesCriteria(criteria: ICriteria, state: boolean): void {
		this.countryBoard.showCriteria(criteria, state);
	}

	/**
	 * Show/Hide a coneMeshCollection
	 * @todo unused and irrelevant @see countryBoard.showCriteria
	 * @param {ICriteria} criteria
	 * @param {boolean} state
	 * @memberof BigBoard
	 */
	public showConesCriteria(criteria: ICriteria, state: boolean): void {
		this.coneBoard.showCriteria(criteria, state);
	}

	/**
	 * Get a countryMeshCollection with all countries verifying 'criteria'
	 * @param {ICriteria} criteria
	 * @returns {CountryMeshShader[]}
	 * @memberof BigBoard
	 */
	public getCountries(criteria: ICriteria): CountryMeshShader[] {
		let result: CountryMeshShader[] = [];
		if (this.countryBoard.show) {
			result = this.countryBoard.searchMesh(criteria);
		}

		return result;
	}

	/**
	 * Get a coneMeshCollection with all cones verifying 'criteria'
	 * @param {ICriteria} criteria
	 * @returns {PseudoCone[]}
	 * @memberof BigBoard
	 */
	public getCones(criteria: ICriteria): PseudoCone[] {
		let result: PseudoCone[] = [];
		if (this.coneBoard.show) {
			result = this.coneBoard.searchMesh(criteria);
		}

		return result;
	}

	/**
	 * Extrude countriesMeshCollection  with criteria by a factor value
	 * @param {ICriteria} criteria
	 * @param {number} [value]
	 * @memberof BigBoard
	 */
	public extrude(criteria: ICriteria, value?: number): void {
		this.countryBoard.extrude(criteria, value);
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
	 * Rescale all text by the sizeText p
	 * @memberof BigBoard
	 */
	public rescaleText(): void {
		for (let i = this._geometryText.children.length - 1; i >= 0; i--) {
			this._geometryText.children[i].scale.set(this._sizeText, this._sizeText, this._sizeText);
		}
	}

	/**
	 * Update all the city which will be displayed regarding the population threshold parameter
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
				const geometry = new TextGeometry(obj.cityName, CONFIGURATION.TEXT_GEOMETRY_OPTIONS);
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
	 * Initializing the scene
	 * @private
	 * @memberof BigBoard
	 */
	private _init(element: HTMLElement): HTMLDivElement {
		const container = document.createElement('div');
		element.appendChild(container);
		this._stats = new Stats();
		this._stats.domElement.style.position = 'absolute';
		this._stats.domElement.style.top = '50px';
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
		this._sizeText = 1;
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
				if (this.orthographic) {
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
		const groupCountry = new Group();
		const groupCone = new Group();
		const groupCurveShortHaul = new Group();
		const groupCurvesLongHaul = new Group();
		this.coneBoard.coneMeshCollection.forEach((cone) => groupCone.add(cone));
		this.countryBoard.countryMeshCollection.forEach((country) => groupCountry.add(country));
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
		const blobCountry = new Blob([exporter.parse(groupCountry)], {
			type: 'text/plain;charset=utf-8',
		});
		const zip = new jszip();
		zip.file('sceneCones.obj', blobCone);
		zip.file('sceneCurvesShortHaul.obj', blobCurveShort);
		zip.file('sceneCurvesLongHaul.obj', blobCurveLong);
		zip.file('country.obj', blobCountry);
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
		const camera = this.orthographic ? this._cameraO : this._cameraP;
		this._controls.object = camera;
		requestAnimationFrame(() => this._animate());
		this._renderer.render(scene, camera);
		this._stats.update();
		this._controls.update();
		CONFIGURATION.tick();
	}

	public addLegend() {
		const alpha = this._merger.codeSpeedPerYear['Road'].alpha;

		if (!document.getElementById('legendID')) {
			console.log('create legend ! ');
			const legend = document.createElement('canvas');
			legend.id = 'legendID';
			const styleLegend = legend.style;
			styleLegend.font = '14px/32px Arial, Halvetica, sans-serif';
			styleLegend.zIndex = '1000';
			styleLegend.position = 'absolute';
			styleLegend.bottom = '3%';
			styleLegend.right = '2%';
			legend.width = 50;
			legend.height = Math.tan(alpha) * (legend.width / 2);
			document.body.append(legend);
		} else {
			const canvas = <HTMLCanvasElement>document.getElementById('legendID');
			this.resetDimensions(alpha, canvas);
		}

		//const color = '#' + (0x1000000 + Math.random() * 0xffffff).toString(16).substr(1, 6);
		const drawer = this.Drawer('legendID', alpha);
		console.log(alpha);
		const move = this.createMoveable('legendID');
		move.updateRect();
		//drawer(alpha, -7.5, '#0000FF'); // la valeur -7,5 correspond à la valeur trouvée par déduction
		drawer(alpha, -(Math.tan(alpha) / 2), '#0000FF');

		// display the slope and speed of each means of transport existing for a given year ( Configuration.year)
		let title = 'Slope : ' + Math.round(((alpha * 180) / Math.PI) * 10) / 10 + '° \n';
		Object.keys(this._merger.codeSpeedPerYear).forEach((el) => {
			console.log(el);
			title += el + ' : ' + this._merger.codeSpeedPerYear[el].speed + ' Kph ' + '\n';
		});

		document.getElementById('legendID').addEventListener(
			'mouseover',
			function () {
				document.getElementById('legendID').title = title;
			},
			false
		);
	}

	private setupCanvas(canvas) {
		// Get the device pixel ratio, falling back to 1.
		const dpr = window.devicePixelRatio || 1;
		// Get the size of the canvas in CSS pixels.
		const rect = canvas.getBoundingClientRect();
		console.log(rect);
		// Give the canvas pixel dimensions of their CSS
		// size * the device pixel ratio.
		canvas.width = rect.width * dpr;
		canvas.height = rect.height * dpr;
		const ctx = canvas.getContext('2d');
		// Scale all drawing operations by the dpr, so you
		// don't have to worry about the difference.
		ctx.scale(dpr, dpr);
		return ctx;
	}
	private Drawer(canvasId, alphaM) {
		const canvas = <HTMLCanvasElement>document.getElementById(canvasId);
		//canvas.height = (7.5 * canvas.width) / devicePixelRatio;
		canvas.height = (Math.tan(alphaM) * (canvas.width / 2)) / devicePixelRatio;
		const ctx = this.setupCanvas(canvas);
		ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
		const A = 1; // A=1 c'est une valeur comme une autre qui a peu d'importance pour la suite car tout est proportionel!
		const xmin = -A / 2;
		const xmax = A / 2;
		const ymax = 0;
		return function (alpha, ymin = null, color = '#0000FF') {
			const Height = canvas.height;
			const Width = canvas.width;
			ymin = ymin === null ? (Height / Width) * 20 : ymin;
			function toCnv(x, y) {
				return [(Width * (x - xmin)) / (xmax - xmin), (Height * (ymax - y)) / (ymax - ymin)];
			}
			console.log('[', canvas.width, ',', canvas.height, ']');
			const H = Math.tan(alpha) * xmax;
			console.log(H);
			ctx.beginPath();
			ctx.moveTo(...toCnv(xmin, 0)); // point en haut à gauche
			ctx.lineTo(...toCnv(xmax, 0)); // point en haut droite
			ctx.lineTo(...toCnv(0, -H)); //point bas milieu
			ctx.closePath();
			ctx.strokeStyle = color;
			ctx.lineWidth = 2;
			ctx.stroke();
			console.log(toCnv(xmin, 0), toCnv(xmax, 0), toCnv(0, -H));
		};
	}
	private createMoveable(canvasID) {
		// remove any previous moveable
		const divs = document.querySelectorAll('.moveable1');
		Array.from(divs).forEach((div) => div.remove());
		const canvas = <HTMLCanvasElement>document.getElementById(canvasID);
		// create new moveable
		const move = new Moveable(document.body, {
			target: document.getElementById(canvasID),
			className: 'moveable1',
			origin: false,
			draggable: true,
			scalable: true,
			resizable: true,
			keepRatio: true,
			rotatable: true,
		});
		move.on('drag', ({ target, transform }) => {
			target.style.transform = transform;
			move.updateRect();
		});
		move.on('resize', ({ target, width, height }) => {
			target.style.width = width + 'px';
			target.style.height = height + 'px';
			move.updateRect();
		});
		move.on('rotate', ({ target, transform }) => {
			target.style.transform = transform;
			move.updateRect();
		});
		return move;
	}
	private resetDimensions(alpha, canvas) {
		canvas.width = 50;
		canvas.height = Math.tan(alpha) * (canvas.width / 2);
		canvas.style.width = canvas.width + 'px';
		canvas.style.height = canvas.height + 'px';
	}
}
