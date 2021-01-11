'use strict';
import { Scene, Camera, WebGLRenderer, Raycaster, Mesh, Vector2, BufferGeometry, Material } from 'three';
import { CONFIGURATION } from '../common/configuration';
import type { PseudoCone } from './base';
import { ConeMeshShader } from './coneMeshShader';
import { Cartographic, searchCriteria } from '../common/utils';
import type { ISumUpCriteria, ILookupCurvesAndCityGraph, ICriteria as ICriteria } from '../definitions/project';
import type { CountryBoard } from '../country/countryBoard';
import { CurveMeshShader } from './curveMeshShader';
const forbiddenAttributes = ['referential', 'position'];

export class ConeBoard {
	public coneMeshCollection: PseudoCone[] = [];
	public curveCollection: CurveMeshShader[] = [];
	private readonly _scene: Scene;
	private readonly _camera: Camera;
	private readonly _raycaster: Raycaster;
	private _highlightedCriteria: ICriteria = {};
	private _selectedMeshes: Mesh[] = [];
	private _scale = 1;
	private _show = true;
	private _withLimits = true;
	private readonly _countries: CountryBoard;
	private _sumUpProperties: ISumUpCriteria = {};
	private readonly _renderer: WebGLRenderer;
	private _opacity = 1;

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
		this._selectedMeshes.forEach((mesh) => {
			mesh.scale.setScalar(value);
		});
		this.coneMeshCollection.forEach((mesh) => {
			mesh.scale.setScalar(value);
		});
		this._scale = value;
	}

	get lookupCriteria(): ISumUpCriteria {
		return this._sumUpProperties;
	}

	get opacity(): number {
		return this._opacity;
	}

	set opacity(value: number) {
		if (value > 0 && value <= 1) {
			this._opacity = value;
			this.coneMeshCollection.forEach((cone) => {
				(<Material>cone.material).opacity = value;
			});
		}
	}

	public constructor(scene: Scene, camera: Camera, countries: CountryBoard, renderer: WebGLRenderer) {
		this._scene = scene;
		this._camera = camera;
		this._raycaster = new Raycaster();
		this._countries = countries;
		this._renderer = renderer;
	}

	/**
	 *
	 * @param lookup
	 */
	public add(lookup: ILookupCurvesAndCityGraph): void {
		this.clean();
		const bBoxes = this._countries.countryMeshCollection.map((country) => country.bBox);
		console.log('city network', lookup.lookupCityNetwork);
		void ConeMeshShader.generateCones(lookup.lookupCityNetwork, bBoxes).then((cones) => {
			cones.forEach((cone) => {
				// UpdateSumUpCriteria(that._sumUpProperties, cone.otherProperties);
				// add object name to cone
				cone.name = cone.otherProperties.origCityProperties.cityName;
				this.coneMeshCollection.push(cone);
				cone.scale.setScalar(this._scale);
				this._scene.add(cone);
				this._renderer.render(this._scene, this._camera);
			});
		});
		void CurveMeshShader.generateCones(lookup.curvesData).then((curves) => {
			curves.forEach((curve) => {
				this.curveCollection.push(curve);
				curve.visible = this._show;
				curve.scale.setScalar(this._scale);
				this._scene.add(curve);
				this._renderer.render(this._scene, this._camera);
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

		for (let i = this.curveCollection.length - 1; i >= 0; i--) {
			this._scene.remove(this.curveCollection[i]);
			this.curveCollection[i].dispose();
			this.curveCollection.splice(i, 1);
		}

		this._sumUpProperties = {};
	}

	public getMeshByMouse(event: MouseEvent, highLight = false): PseudoCone {
		let result: PseudoCone;
		const mouse = new Vector2();
		mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
		mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
		this._raycaster.setFromCamera(mouse, this._camera);
		const intersects = this._raycaster.intersectObjects(this.coneMeshCollection);
		if (intersects.length > 0) {
			result = <PseudoCone>intersects[0].object;
			this.highLight(result.otherProperties, highLight);
		} else {
			this._selectedMeshes.forEach((mesh) => {
				if (!Array.isArray(mesh.material)) {
					mesh.material.visible = false;
				}
			});
		}

		return result;
	}

	public setLimits(criteria: ICriteria, limit: boolean): void {
		this.searchMesh(criteria).forEach((country) => {
			country.withLimits = limit;
		});
	}

	public highLight(criteria: ICriteria, light: boolean): void {
		if (criteria !== this._highlightedCriteria) {
			this._highlightedCriteria = criteria;
			this._selectedMeshes.forEach((mesh) => {
				this._scene.remove(mesh);
			});
			this._selectedMeshes = this.searchMesh(criteria).map((mesh) => {
				const geometry = <BufferGeometry>mesh.geometry.clone();
				const out = new Mesh(geometry, CONFIGURATION.highLightedMaterial);
				this._scene.add(out);
				out.scale.setScalar(this._scale);
				return out;
			});
		}

		this._selectedMeshes.forEach((mesh) => {
			if (!Array.isArray(mesh.material)) {
				mesh.material.visible = light;
			}
		});
	}

	public searchMesh(criteria: ICriteria | Cartographic, path = ''): PseudoCone[] {
		let result: PseudoCone[];
		if (criteria instanceof Cartographic) {
			result = this.coneMeshCollection.filter(
				(cone) => cone.cartographicPosition.approximateDistance(criteria) < 1e-13
			);
		} else {
			result = searchCriteria(this.coneMeshCollection, criteria, forbiddenAttributes, 'otherProperties.' + path);
		}

		return result;
	}

	public showCriteria(criteria: ICriteria, state: boolean): void {
		const realState = state && this._show;
		this.searchMesh(criteria).forEach((cone) => {
			cone.visible = realState;
		});
	}

	// Private _reHighLight(): void {
	//     if (this._selectedMeshes.length > 0) {
	//         let visible = false;
	//         let temp = this._selectedMeshes[0];
	//         if (!Array.isArray(temp.material)) {
	//             visible = temp.material.visible;
	//         }
	//         let criteria = this._highlightedCriteria;
	//         this._highlightedCriteria = undefined;
	//         this.highLight(criteria, visible);
	//     }
	// }
}
