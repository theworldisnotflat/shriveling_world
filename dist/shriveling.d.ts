/// <reference types="three" />
declare namespace shriveling {
    class CountryBoard {
        static highLitedMaterial: THREE.Material;
        countryMeshCollection: CountryMesh[];
        private _projection;
        private _scene;
        private _isReprojecting;
        private _camera;
        private _raycaster;
        private _highlitedMeshName;
        private _selectedMeshs;
        static extrude(meshes: CountryMesh[], value?: number | number[], timing?: number, init?: number, easingFunction?: {
            (k: number): number;
        }): void;
        constructor(geoJson: any, mainProjector: string, scene: THREE.Scene, camera: THREE.Camera);
        add(geoJson: any): void;
        projection: string;
        changeProjection(projection: string, timing?: number, easingFunction?: {
            (k: number): number;
        }): void;
        clean(): void;
        getMeshByMouse(event: MouseEvent, highLight?: boolean): string;
        getMeshes(name: string): CountryMesh[];
        extrudeByName(name: string, value?: number): void;
        extrudeByArray(tab?: CountryMesh[], value?: number): void;
    }
}
declare namespace shriveling {
    var deg2rad: number;
    var rad2deg: number;
    var earthRadiusMeters: number;
    interface ITypeExtrusion {
        none: number;
        extruded: number;
    }
    class CountryGeometry extends THREE.Geometry {
        static lookupGeometry: {
            [projection: string]: ITypeExtrusion;
        };
        properties: any;
        private _projection;
        static generator(geoJson: any, mainProjector: string): CountryGeometry[];
        projection: string;
        acceptProjection(value: string): boolean;
        fuzzyClone(): THREE.Geometry;
        private constructor(name, properties, boundary, mainProjector, reverseLookup);
    }
}
declare namespace shriveling {
    interface ICountryTextureURL {
        map: string;
        specularMap: string;
        bumpMap: string;
        normalMap: string;
    }
    class CountryMesh extends THREE.Mesh {
        static COUNTRY_TEXTURES: ICountryTextureURL;
        private static NORMAL_MATERIAL;
        private _extruded;
        private _reprojectName;
        private _reprojectIndex;
        private _extrudedIndex;
        static generator(geoJson: any, mainProjector: string): CountryMesh[];
        extruded: number;
        properties: any;
        projection: string;
        reProject(value: string | number): void;
        private constructor(geometry);
    }
}
declare namespace shriveling {
    var deg2rad: number;
    var rad2deg: number;
    var earthRadiusMeters: number;
    var mapProjectors: IConverterLookup;
    class Cartographic {
        static THREE_EARTH_RADIUS: number;
        latitude: number;
        longitude: number;
        height: number;
        static distanceApproximee(pos1: Cartographic, pos2: Cartographic): number;
        static distanceExacte(pos1: Cartographic, pos2: Cartographic): number;
        static lerp(pos1: Cartographic, pos2: Cartographic, fractions?: number[]): Cartographic[];
        constructor(longitude?: number, latitude?: number, height?: number, isRadians?: boolean);
        clone(): Cartographic;
        distanceApproximee(pos2: Cartographic): number;
        distanceExacte(pos2: Cartographic): number;
        lerp(pos2: Cartographic, fractions?: number[]): Cartographic[];
        toTHREEVector3(nameProJections?: string[]): {
            [name: string]: THREE.Vector3;
        };
    }
    interface IConverterLookup {
        [name: string]: (pos: Cartographic) => THREE.Vector3;
    }
    interface IMapProjector {
        name: string;
        converter: (pos: Cartographic) => THREE.Vector3;
    }
    function DragnDrop(id: string | HTMLElement, callback: (text: string, name?: string) => void, scope: any): void;
}
