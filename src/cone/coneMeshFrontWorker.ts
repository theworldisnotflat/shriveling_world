namespace shriveling {
    'use strict';
    const forbiddenAttributes = ['referential', 'position', 'transports'];
    let _dirtyLimits = false;
    let _ready = false;
    let uuid = undefined;
    let _worker: Worker;
    let _tickCount = 0;
    let _cones: ConeMeshFrontWorker[] = [];
    let start = performance.now();
    function showStats(info: string): void {
        let end = performance.now();

        console.log(info, (end - start) / 1000);
        start = performance.now();
    }
    export class ConeMeshFrontWorker extends PseudoCone {

        public otherProperties: any;
        private _withLimits: boolean;
        private _cityCode: string;
        private _position: Cartographic;

        public static generateCones(lookup: ILookupTownTransport, bboxes: IBBox[]): Promise<ConeMeshFrontWorker[]> {
            _ready = false;
            _cones = [];
            start = performance.now();
            let coneWorkers: { cityCode: string, directions: ILookupDirection }[] = [];
            let towns: { [cityCode: string]: NEDLocal } = {};
            for (let cityCode in lookup) {
                if (lookup.hasOwnProperty(cityCode)) {
                    let townTransport = lookup[cityCode];
                    let position = townTransport.referential.cartoRef;
                    towns[cityCode] = townTransport.referential;
                    let transports = townTransport.transports;
                    let commonProperties = {};
                    for (let attribute in townTransport) {
                        if (townTransport.hasOwnProperty(attribute) && forbiddenAttributes.indexOf(attribute) === -1) {
                            commonProperties[attribute] = townTransport[attribute];
                        }
                    }
                    for (let transportName in transports) {
                        if (transports.hasOwnProperty(transportName)) {
                            let directions = transports[transportName];
                            let specificProperties =
                                Object.assign({}, commonProperties, { directions: directions, transport: transportName });
                            _cones.push(new ConeMeshFrontWorker(cityCode, position, specificProperties));
                            coneWorkers.push({ cityCode: cityCode, directions: directions });
                        }
                    }
                }
            }
            showStats('preparations');
            if (uuid === undefined) {
                _worker = Workers.generateWorker('coneShaderBackWorker');
                _worker.addEventListener('message', (event) => {
                    if (event.data.action === 'information') {
                        console.log(event.data.data);
                    } else if (event.data.action === 'cones') {
                        let datas = event.data.data;
                        let positions = new Float32Array(datas.positions);
                        let boundingBoxes = new Float32Array(datas.boundingBoxes);
                        let disabledCones = <number[]>datas.disabledCones;
                        let width = <number>datas.width;
                        let normals: Float32Array;
                        if (datas.normals !== undefined) { normals = new Float32Array(datas.normals); }
                        let index: Uint16Array;
                        if (datas.index !== undefined) { index = new Uint16Array(datas.index); }
                        let uvs: Float32Array;
                        if (datas.uvs !== undefined) { uvs = new Float32Array(datas.uvs); }
                        for (let i = 0; i < _cones.length; i++) {
                            let geometry = <THREE.BufferGeometry>_cones[i].geometry;
                            if (disabledCones.indexOf(i) === -1) {
                                let interleavedBuffer = (<THREE.InterleavedBufferAttribute>geometry.getAttribute('position')).data;
                                interleavedBuffer.set(positions.subarray(i * width * 4, (i + 1) * width * 4), 0);
                                interleavedBuffer.needsUpdate = true;
                                let center = geometry.boundingSphere.center;
                                center.setX(boundingBoxes[i * 4]);
                                center.setY(boundingBoxes[i * 4 + 1]);
                                center.setZ(boundingBoxes[i * 4 + 2]);
                                geometry.boundingSphere.radius = boundingBoxes[i * 4 + 3];
                                if (normals !== undefined) {
                                    interleavedBuffer = (<THREE.InterleavedBufferAttribute>geometry.getAttribute('normal')).data;
                                    interleavedBuffer.set(normals.subarray(i * width * 4, (i + 1) * width * 4), 0);
                                    interleavedBuffer.needsUpdate = true;
                                }
                                if (index !== undefined) {
                                    geometry.getIndex().set(index, 0);
                                    geometry.getIndex().needsUpdate = true;
                                    let bufferAttribute = (<THREE.BufferAttribute>geometry.getAttribute('uv'));
                                    bufferAttribute.set(uvs);
                                    bufferAttribute.needsUpdate = true;
                                    geometry.setDrawRange(0, index.length);
                                }
                            } else {
                                geometry.setDrawRange(0, 0);
                            }
                        }
                        _ready = true;
                        showStats('retours cones');
                    }
                });
                uuid = Configuration.addEventListener(
                    'heightRatio intrudedHeightRatio coneStep referenceEquiRectangular lambda0Mercator THREE_EARTH_RADIUS ' +
                    'projectionBegin projectionEnd projectionPercent year tick',
                    (name: string, value: any) => {
                        if (_ready === true) {
                            start = performance.now();
                            let message = { action: '', data: {} };
                            let skip = false;
                            switch (name) {
                                case 'coneStep':
                                    message.action = 'coneStep';
                                    message.data['conestep'] = Configuration.coneStep;
                                    break;
                                case 'year':
                                    message.action = 'year';
                                    message.data['year'] = Configuration.year;
                                    break;
                                case 'tick':
                                    if (_dirtyLimits === true && _tickCount % 10 === 1) {
                                        let height = _cones.length;
                                        let withLimits = new Uint8Array(height);
                                        for (let i = 0; i < height; i++) {
                                            withLimits[i] = _cones[i].withLimits ? 1 : 0;
                                        }
                                        message.action = 'limits';
                                        message.data['limits'] = withLimits;
                                        _dirtyLimits = false;
                                    } else {
                                        _tickCount++;
                                        skip = true;
                                    }
                                    if (_tickCount > 10) {
                                        _tickCount = 0;
                                    }
                                    break;
                                case 'projectionBegin':
                                    message.action = 'projectionBegin';
                                    break;
                                default:
                                    message.action = name;
                            }
                            if (skip === false) {
                                let uniforms: { [x: string]: number | ArrayBufferView } = {};
                                uniforms.longueurMaxi = Configuration.extrudedHeight;
                                uniforms.threeRadius = Configuration.THREE_EARTH_RADIUS;
                                uniforms.earthRadius = Configuration.earthRadiusMeters;
                                uniforms.referenceEquiRectangular = Configuration.referenceEquiRectangularArray;
                                uniforms.lambda0 = Configuration.lambda0Mercator;
                                uniforms.representationInit = Configuration.projectionInit;
                                uniforms.representationEnd = Configuration.projectionEnd;
                                uniforms.percentRepresentation = Configuration.percentProjection;
                                message.data['uniforms'] = uniforms;
                                _worker.postMessage(message);
                            }
                        }
                    });
            }
            let message = { action: 'init', data: {} };
            message.data['towns'] = JSON.stringify(towns);
            message.data['bboxes'] = JSON.stringify(bboxes);
            message.data['cones'] = coneWorkers;
            message.data['conestep'] = Configuration.coneStep;
            message.data['year'] = Configuration.year;
            let height = _cones.length;
            let withLimits = new Uint8Array(height);
            for (let i = 0; i < height; i++) {
                withLimits[i] = _cones[i].withLimits ? 1 : 0;
            }
            message.data['limits'] = withLimits;
            let uniforms: { [x: string]: number | ArrayBufferView } = {};
            uniforms.longueurMaxi = Configuration.extrudedHeight;
            uniforms.threeRadius = Configuration.THREE_EARTH_RADIUS;
            uniforms.earthRadius = Configuration.earthRadiusMeters;
            uniforms.referenceEquiRectangular = Configuration.referenceEquiRectangularArray;
            uniforms.lambda0 = Configuration.lambda0Mercator;
            uniforms.representationInit = Configuration.projectionInit;
            uniforms.representationEnd = Configuration.projectionEnd;
            uniforms.percentRepresentation = Configuration.percentProjection;
            message.data['uniforms'] = uniforms;
            _worker.postMessage(message);
            return Promise.resolve([..._cones]);
        }

        private constructor(cityCode: string, position: Cartographic, properties: any) {
            const interleavedBufferPosition = new THREE.InterleavedBuffer(new Float32Array(400 * 4), 4).setDynamic(true);
            const interleavedBufferAttributePosition = new THREE.InterleavedBufferAttribute(interleavedBufferPosition, 3, 0, false);
            const interleavedBufferNormal = new THREE.InterleavedBuffer(new Float32Array(400 * 4), 4).setDynamic(true);
            const interleavedBufferAttributeNormal = new THREE.InterleavedBufferAttribute(interleavedBufferNormal, 3, 0, false);
            const bufferGeometry = new THREE.BufferGeometry();
            bufferGeometry.addAttribute('position', interleavedBufferAttributePosition);
            bufferGeometry.addAttribute('normal', interleavedBufferAttributeNormal);
            bufferGeometry.addAttribute('uv', new THREE.BufferAttribute(new Float32Array(400 * 2), 2).setDynamic(true));
            bufferGeometry.setIndex(new THREE.BufferAttribute(new Uint16Array(400 * 6), 1).setDynamic(true));
            bufferGeometry.setDrawRange(0, 0);
            bufferGeometry.computeBoundingSphere();
            bufferGeometry.boundingSphere = new THREE.Sphere();
            super(bufferGeometry, Configuration.BASIC_CONE_MATERIAL.clone());
            this._cityCode = cityCode;
            this._position = position;
            this.otherProperties = properties;
            this._withLimits = true;
            this.visible = true;
        }

        get cityCode(): string {
            return this._cityCode;
        }
        get cartographicPosition(): Cartographic {
            return this._position;
        }

        get withLimits(): boolean {
            return this._withLimits;
        }

        set withLimits(value: boolean) {
            if (value !== this._withLimits) {
                _dirtyLimits = true;
                this._withLimits = value;
            }
        }
    }
}
