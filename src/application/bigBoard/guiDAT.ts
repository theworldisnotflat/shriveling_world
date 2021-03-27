'use strict';
import type { LineBasicMaterial, MeshPhongMaterial } from 'three';
import type { Merger } from './merger';
import { DragNDrop as DragNDrop } from '../common/utils';
import type { IListFile, CONESSHAPE_ENUM, CURVESPOSITION_ENUM } from '../definitions/project';
import type BigBoard from './bigBoard';
import { ConeMeshShader } from '../cone/coneMeshShader';
import * as dat from 'dat.gui';
import { CONFIGURATION } from '../common/configuration';

let _filesData: IListFile[] = [];
const countryControllersList: dat.GUI[] = [];
const aerialControllersList: dat.GUI[] = [];
let terrestrialFolder: dat.GUI;
const terrestrialControllersList: dat.GUI[] = [];
let flagTransportDone = false;
let countryFolder: dat.GUI;
let years: dat.GUIController;
let generalFolder: dat.GUI;
let aerialFolder: dat.GUI;
let coneFolder: dat.GUI;
let conf = {
	coneStep: 0,
	year: 0,
	projection: {
		aucun: 0,
		equirectangulaire: 1,
		Mercator: 2,
		Winkel: 3,
		Eckert: 4,
		'Van Der Grinten': 5,
		'conic equidistant': 6,
	},
	conesShape: {
		'based on road': 0,
		'based on the fastest terrestrial mode': 1,
		complex: 2,
	},
	curvesPosition: {
		above: 0,
		below: 1,
		belowWhenPossible: 2,
		stickToCone: 3,
	},
	'transport type': '',
	'cones color': '#',
	'cones transparency': 0,
	'curve color': '#',
	'text color': '#',
	'curve transparency': 0,
	'light color': '#',
	intensity: 0,
	'ambient color': '#',
	longitude: 0,
	latitude: 0,
	hauteur: 0,
	'standard parrallel 1': 0,
	'standard parrallel 2': 0,
	'with limits': true,
	exportCountry: true,
	'z coefficient': 0,
};

export class GUI {
	private readonly _bigBoard: BigBoard;
	private readonly _merger: Merger;

	public constructor(bigBoard: BigBoard, container: HTMLElement, merger: Merger) {
		this._bigBoard = bigBoard;
		this._merger = merger;
		conf = {
			coneStep: CONFIGURATION.coneStep * CONFIGURATION.rad2deg,
			year: Number.parseInt(<string>CONFIGURATION.year, 10),
			projection: {
				aucun: 0,
				equirectangulaire: 1,
				Mercator: 2,
				Winkel: 3,
				Eckert: 4,
				'Van Der Grinten': 5,
				'conic equidistant': 6,
			},
			conesShape: {
				'based on road': 0,
				'based on the fastest terrestrial mode': 1,
				complex: 2,
			},
			curvesPosition: {
				above: 0,
				below: 1,
				belowWhenPossible: 2,
				stickToCone: 3,
			},
			'transport type': '',
			'cones color': '#' + (<any>CONFIGURATION.BASIC_CONE_MATERIAL).color.getHex().toString(16),
			'cones transparency': CONFIGURATION.BASIC_CONE_MATERIAL.opacity,
			'curve color': '#' + CONFIGURATION.BASIC_LINE_MATERIAL.color.getHex().toString(16),
			'text color': '#' + CONFIGURATION.BASIC_TEXT_MATERIAL.color.getHex().toString(16),
			'curve transparency': CONFIGURATION.BASIC_LINE_MATERIAL.opacity,
			'light color': '#' + bigBoard.light.color.getHex().toString(16),
			intensity: bigBoard.light.intensity,
			'ambient color': '#' + bigBoard.ambient.color.getHex().toString(16),
			longitude: CONFIGURATION.referenceEquiRectangular.longitude,
			latitude: CONFIGURATION.referenceEquiRectangular.latitude,
			hauteur: CONFIGURATION.referenceEquiRectangular.height,
			'standard parrallel 1': CONFIGURATION.standardParallel1 * CONFIGURATION.rad2deg,
			'standard parrallel 2': CONFIGURATION.standardParallel2 * CONFIGURATION.rad2deg,
			'with limits': true,
			exportCountry: bigBoard.orthographic,
			'z coefficient': CONFIGURATION.zCoeff,
		};
		this._initInteraction(container);
	}

	public async filesToInsert(list: IListFile[]): Promise<number> {
		const bigBoard = this._bigBoard;
		// Container en paramètre
		if (_filesData.length === 0) {
			bigBoard.countryBoard.ready = false;
		}

		_filesData.push(...list);
		let json: string;
		_filesData.forEach((item) => {
			const fileName = item.name.toLowerCase();
			if (fileName.endsWith('.geojson')) {
				json = item.text;
			} else if (fileName.endsWith('.csv')) {
				this._merger.addFile(item.text);
				if (bigBoard.state === 'ready') {
					// This is when all processes are launched
					this._merger.merge();
				}
			}
		});
		void Promise.all([
			new Promise<void>((resolve) => {
				if (!bigBoard.countryBoard.ready && json !== undefined) {
					void bigBoard.countryBoard.add(JSON.parse(json)).then(() => {
						while (countryControllersList.length > 0) {
							const subGui = countryControllersList.pop();
							countryFolder.removeFolder(subGui);
						}

						const synonyms: string[] = [];
						bigBoard.countryBoard.countryMeshCollection
							.sort((a, b) => a.mainName.localeCompare(b.mainName))
							.forEach((country) => {
								let countryName = country.mainName;
								let i = -1;
								while (synonyms.includes(countryName)) {
									i++;
									countryName = country.mainName + i;
								}

								synonyms.push(countryName);
								const folder = countryFolder.addFolder(countryName);
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
			new Promise<void>((resolve) => {
				if (bigBoard.state === 'complete' && !flagTransportDone) {
					flagTransportDone = true;
					while (terrestrialControllersList.length > 0) {
						const subGui = terrestrialControllersList.pop();
						terrestrialFolder.removeFolder(subGui);
					}

					while (aerialControllersList.length > 0) {
						const subGui = aerialControllersList.pop();
						aerialFolder.removeFolder(subGui);
					}

					// Adding aerial network(s)
					this._merger.transportNames.curves.forEach((transportName) => {
						const folder = aerialFolder.addFolder(transportName);
						aerialControllersList.push(folder);
						function curveListener(): void {
							const opacity = <number>curveOpacity.getValue();
							const color = Number.parseInt(curveColor.getValue().replace('#', ''), 16);
							bigBoard.coneAndCurveBoard.curveCollection
								.filter((curve) => transportName === curve.transportName)
								.forEach((curve) => {
									const material = <LineBasicMaterial>curve.material;
									material.color.setHex(color);
									material.opacity = opacity;
								});
						}

						const curveColor = folder.addColor(conf, 'curve color').name('color');
						curveColor.onChange(curveListener);
						const curveOpacity = folder.add(conf, 'curve transparency', 0, 1, 0.01).name('transparency');
						curveOpacity.onChange(curveListener);
					});
					// Adding terrestrial networks
					console.log('Adding terrestrial network');
					this._merger.transportNames.cones.forEach((transportName) => {
						const folder = terrestrialFolder.addFolder(transportName);
						terrestrialControllersList.push(folder);

						function curveListener(): void {
							const opacity = <number>curveOpacity.getValue();
							const color = Number.parseInt(curveColor.getValue().replace('#', ''), 16);

							bigBoard.coneAndCurveBoard.curveCollection
								.filter((curve) => transportName === curve.transportName)
								.forEach((curve) => {
									const material = <LineBasicMaterial>curve.material;
									material.color.setHex(color);
									material.opacity = opacity;
								});
						}

						const curveColor = folder.addColor(conf, 'curve color').name('color');
						curveColor.onChange(curveListener);
						const curveOpacity = folder.add(conf, 'curve transparency', 0, 1, 0.01).name('transparency');
						curveOpacity.onChange(curveListener);
						const curvesPosition = folder
							.add(CONFIGURATION, 'curvesPosition', conf.curvesPosition)
							.name('curves position')
							.onChange((value: CURVESPOSITION_ENUM) => {
								bigBoard.coneAndCurveBoard.curveCollection
									.filter((curve) => transportName === curve.transportName)
									.forEach((curve) => {
										CONFIGURATION.curvesPosition = value;
										curve.curvesPosition = value;
										console.log(curve.curvesPosition);
									});
								CONFIGURATION.curvesPosition = conf.curvesPosition.above;
							});
					});
				}

				resolve();
			}),
		]).then(() => {
			if (bigBoard.countryBoard.ready && bigBoard.state === 'complete') {
				flagTransportDone = false;
				years.min(this._merger.firstYear).max(this._merger.lastYear).updateDisplay();
				bigBoard.coneAndCurveBoard.add(this._merger.conesAndCurvesData);
				// This._merger.clear();
				const sizeText = generalFolder.add(bigBoard, '_sizeText', 0, 2).name('taille du texte').step(0.1);
				sizeText.onChange(() => bigBoard.rescaleText());
				generalFolder.addColor(conf, 'text color').onChange((v: string) => {
					const color = Number.parseInt(v.replace('#', ''), 16);
					CONFIGURATION.BASIC_TEXT_MATERIAL.color.setHex(color);
					bigBoard.updateCityName();
				});
				_filesData = [];
			}
		});
		return 0;
	}

	/**
	 * InitInteraction : Initialize GUI
	 */
	private _initInteraction(container: HTMLElement): void {
		const gui = new dat.GUI({ autoPlace: false });
		container.appendChild(gui.domElement);
		const bigBoard = this._bigBoard;
		conf['light color'] = '#' + bigBoard.light.color.getHex().toString(16);
		conf.intensity = bigBoard.light.intensity;
		conf['ambient color'] = '#' + bigBoard.ambient.color.getHex().toString(16);
		conf.exportCountry = bigBoard.orthographic;

		// Light
		const lightFolder = gui.addFolder('Light');
		lightFolder.add(bigBoard.ambient, 'intensity', 0, 5, 0.01).name('ambient intensity');
		lightFolder.addColor(conf, 'light color').onChange((v: string) => {
			const color = Number.parseInt(v.replace('#', ''), 16);
			bigBoard.light.color.setHex(color);
			bigBoard.helper.color = color;
			bigBoard.helper.update();
		});
		lightFolder.addColor(conf, 'ambient color').onChange((v: string) => {
			const color = Number.parseInt(v.replace('#', ''), 16);
			bigBoard.ambient.color.setHex(color);
		});
		lightFolder
			.add(conf, 'intensity', 0, 5, 0.01)
			.name('light intensity')
			.onChange((v: number) => {
				bigBoard.light.intensity = v;
				bigBoard.helper.update();
			});

		lightFolder.add(bigBoard.light.position, 'x', -100, 100, 1).onChange(() => bigBoard.helper.update());
		lightFolder.add(bigBoard.light.position, 'y', -100, 100, 1).onChange(() => bigBoard.helper.update());
		lightFolder.add(bigBoard.light.position, 'z', -100, 100, 1).onChange(() => bigBoard.helper.update());
		lightFolder.add(bigBoard.light.shadow.mapSize, 'width', 0, 1000).step(1);
		lightFolder.add(bigBoard.light.shadow.mapSize, 'height', 0, 1000).step(1);
		lightFolder.add(bigBoard.light.shadow.camera, 'near', 0, 1000).step(0.5);
		lightFolder.add(bigBoard.light.shadow.camera, 'far', 0, 1000).step(1);

		// Generalities
		generalFolder = gui.addFolder('Generalities');
		generalFolder
			.add(conf, 'z coefficient', 0, 100)
			.step(0.1)
			.onChange((v) => (CONFIGURATION.zCoeff = v));
		const projectionFolder = generalFolder.addFolder('projection');
		const referenceFolder = projectionFolder.addFolder('references');
		const radius = CONFIGURATION.earthRadiusMeters;
		function changeReference(): void {
			CONFIGURATION.referenceEquiRectangular = {
				longitude: refLong.getValue() * CONFIGURATION.deg2rad,
				latitude: refLat.getValue() * CONFIGURATION.deg2rad,
				height: refHeight.getValue(),
			};
		}

		const refLong = referenceFolder.add(conf, 'longitude', -180, 180).step(0.01);
		refLong.onChange(changeReference);

		const refLat = referenceFolder.add(conf, 'latitude', -89.99, 89.99).step(0.01);
		refLat.onChange(changeReference);
		const refHeight = referenceFolder.add(conf, 'hauteur', -radius + 10, radius + 10).step(1000);
		refHeight.onChange(changeReference);
		referenceFolder.add(conf, 'standard parrallel 1', -90, 90, 0.1).onChange((v: number) => {
			CONFIGURATION.standardParallel1 = v * CONFIGURATION.deg2rad;
		});
		referenceFolder.add(conf, 'standard parrallel 2', -90, 90, 0.1).onChange((v: number) => {
			CONFIGURATION.standardParallel2 = v * CONFIGURATION.deg2rad;
		});
		projectionFolder.add(CONFIGURATION, 'projectionInit', conf.projection).name('initial projection');
		projectionFolder.add(CONFIGURATION, 'projectionEnd', conf.projection).name('final projection');
		projectionFolder.add(CONFIGURATION, 'percentProjection', 0, 100).step(1).name('transition projection');
		years = generalFolder.add(conf, 'year', 1930, 2030).step(1);
		years.onChange((v: string | number) => {
			CONFIGURATION.year = v;
			bigBoard.getMergerI.merge();
			bigBoard.addLegend();
		});

		// Toggle Camera Orthographic/Perspective View
		const swapView = projectionFolder.add(bigBoard, 'orthographic');
		swapView.onChange(() => {
			bigBoard.orthographic = !bigBoard.orthographic;
		});
		generalFolder
			.add(bigBoard, '_showCitiesName')
			.name('Show Cities name')
			.onChange(() => bigBoard.showCitiesName()); // BigBoard to parameter

		// cones
		coneFolder = gui.addFolder('Cones');

		coneFolder
			.add(conf, 'coneStep', 1, 360)
			.step(1)
			.onChange((value: number) => {
				CONFIGURATION.coneStep = value * CONFIGURATION.deg2rad;
			});
		coneFolder.add(ConeMeshShader, 'discriminant', 1, 20).step(1);
		coneFolder.add(bigBoard, 'withLimits').onChange((value: boolean) => {
			conf['with limits'] = value;
		});
		coneFolder
			.add(CONFIGURATION, 'conesShape', conf.conesShape)
			.name('shape of cones')
			.onChange((v: CONESSHAPE_ENUM) => {
				CONFIGURATION.conesShape = v;
			});
		coneFolder.add(bigBoard.coneAndCurveBoard, 'opacity', 0, 1).step(0.01);
		coneFolder.addColor(conf, 'cones color').onChange((v: string) => {
			const color = Number.parseInt(v.replace('#', ''), 16);
			bigBoard.coneAndCurveBoard.coneMeshCollection.forEach((cone) => {
				const material = <MeshPhongMaterial>cone.material;
				material.color.setHex(color);
				material.emissive.setHex(color);
			});
		});
		// Let terrestrialFolder = coneFolder.addFolder('configurations spécifiques');
		// let terrestrialControllersList: dat.GUI[] = [];
		// let flagTransportDone = false;

		// curves
		aerialFolder = gui.addFolder('Curves');
		aerialFolder.add(CONFIGURATION, 'pointsPerCurve', 0, 200).step(1).name('number of points');
		terrestrialFolder = aerialFolder.addFolder('terrestrial modes');

		// Pays /mise en exergue avec listen?
		// countries / highlight with listen?
		countryFolder = gui.addFolder('Countries');
		countryFolder.add(bigBoard.countryBoard, 'show');
		countryFolder.add(bigBoard.countryBoard, 'opacity', 0, 1).step(0.01).name('opacity');
		countryFolder.add(bigBoard.countryBoard, 'extruded', -100, 100).step(1);
		countryFolder
			.add(conf, 'exportCountry')
			.name('Export with continent')
			.onChange(() => {
				bigBoard.orthographic = !bigBoard.orthographic;
			});
		DragNDrop(container, this.filesToInsert, this);
	}
}
