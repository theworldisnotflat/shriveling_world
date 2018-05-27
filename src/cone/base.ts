namespace shriveling {
    'use strict';
    export abstract class PseudoCone extends THREE.Mesh {
        public abstract otherProperties: any;
        public abstract withLimits: boolean;
        public abstract readonly cartographicPosition: Cartographic;
        public abstract readonly cityCode: string;
        constructor(geometry?: THREE.Geometry | THREE.BufferGeometry, material?: THREE.Material) {
            if (geometry instanceof THREE.Geometry) {
                super(geometry, material);
            } else {
                super(geometry, material);
            }
        }
        public dispose(): void {
            this.geometry.dispose();
            (<THREE.Material>this.material).dispose();
        }
    }
}
