namespace shriveling {
    'use strict';

    export interface ICountryTextureURL {
        map: string;
        specularMap: string;
        bumpMap: string;
        normalMap: string;
    }

    export enum PROJECTION_ENUM {
        none = 0,
        equirectangular = 1,
        Mercator = 2,
    }

    interface IEventListItem {
        cb: configurationCallback;
        scope?: any;
        uuid: string;
    }

    export type configurationObservableEvt =
        'heightRatio' | 'intrudedHeightRatio' | 'coneStep' | 'TWEEN_TIMING' | 'referenceEquiRectangular' |
        'lambda0Mercator' | 'THREE_EARTH_RADIUS' | 'projectionBegin' | 'projectionEnd' | 'projectionPercent' | 'year' | 'tick';

    export type configurationCallback = (name: configurationObservableEvt, value: any) => void;

    const _deg2rad: number = Math.PI / 180;
    const _rad2deg: number = 180 / Math.PI;
    const _TWO_PI: number = 2 * Math.PI;
    const _earthRadiusMeters: number = 6371e3;
    const _OVER_PI: number = 1 / Math.PI;
    const _OVER_TWO_PI: number = 1 / (2 * Math.PI);
    const _referenceEquiRectangular: ICartographic = { latitude: 0, longitude: 0, height: 0 };
    const _referenceEquiRectangularFloat32Array = new Float32Array(3);
    let _heightRatio: number = 0;
    let _lambda0Mercator: number = 0;
    let _intrudedHeightRatio: number = 0;
    let _coneStep: number = 0;
    let _TWEEN_TIMING: number = 0;
    let _THREE_EARTH_RADIUS: number = 0;
    let _projectionInit: PROJECTION_ENUM = PROJECTION_ENUM.none;
    let _projectionEnd: PROJECTION_ENUM = PROJECTION_ENUM.none;
    let _projectionPercent: number = 0;
    let _year: string = '';

    let _extrudedHeight: number = 0;
    let _hatHeight: number = 0;
    const _listeners: {
        heightRatio: IEventListItem[],
        intrudedHeightRatio: IEventListItem[],
        coneStep: IEventListItem[],
        TWEEN_TIMING: IEventListItem[],
        referenceEquiRectangular: IEventListItem[],
        lambda0Mercator: IEventListItem[],
        THREE_EARTH_RADIUS: IEventListItem[],
        projectionBegin: IEventListItem[],
        projectionEnd: IEventListItem[],
        projectionPercent: IEventListItem[],
        year: IEventListItem[],
        tick: IEventListItem[],
    } = {
            heightRatio: [],
            intrudedHeightRatio: [],
            coneStep: [],
            TWEEN_TIMING: [],
            referenceEquiRectangular: [],
            lambda0Mercator: [],
            THREE_EARTH_RADIUS: [],
            projectionBegin: [],
            projectionEnd: [],
            projectionPercent: [],
            year: [],
            tick: [],
        };
    function fireEvents(attribute: configurationObservableEvt, value: any): void {
        if (_listeners.hasOwnProperty(attribute)) {
            let callBackList = _listeners[attribute];
            let item: { cb: configurationCallback, scope?: any };
            let scope: any;
            let callBack: configurationCallback;
            for (let i = 0; i < callBackList.length; i++) {
                item = callBackList[i];
                scope = item.scope;
                callBack = item.cb;
                callBack.call(scope, attribute, value);
            }
        }
    }

    export class Configuration {
        public static get deg2rad(): number { return _deg2rad; }
        public static get rad2deg(): number { return _rad2deg; }
        public static get TWO_PI(): number { return _TWO_PI; }
        public static get earthRadiusMeters(): number { return _earthRadiusMeters; }
        public static get OVER_PI(): number { return _OVER_PI; }
        public static get OVER_TWO_PI(): number { return _OVER_TWO_PI; }
        public static highLitedMaterial: THREE.Material;
        public static get heightRatio(): number { return _heightRatio; }
        public static set heightRatio(value: number) {
            _heightRatio = value;
            _hatHeight = _earthRadiusMeters * _heightRatio;
            fireEvents('heightRatio', value);
        }
        public static get intrudedHeightRatio(): number { return _intrudedHeightRatio; }
        public static set intrudedHeightRatio(value: number) {
            _intrudedHeightRatio = value;
            _extrudedHeight = _earthRadiusMeters * _intrudedHeightRatio;
            fireEvents('intrudedHeightRatio', value);
        }
        public static get coneStep(): number { return _coneStep; }
        public static set coneStep(value: number) {
            if (value >= _deg2rad && value < _TWO_PI) {
                _coneStep = value;
                fireEvents('coneStep', value);
            }
        }
        public static get extrudedHeight(): number { return _extrudedHeight; }
        public static get hatHeight(): number { return _hatHeight; }
        public static COUNTRY_TEXTURES: ICountryTextureURL = {
            map: 'assets/earthmap4k.jpg',
            specularMap: 'assets/earthspec4k.jpg',
            bumpMap: 'assets/earthbump4k.jpg',
            normalMap: 'assets/earth_normalmap_flat4k.jpg',
        };
        public static COUNTRY_MATERIAL: THREE.Material;
        public static BASIC_CONE_MATERIAL: THREE.Material;
        public static SKYBOX_URLS: string[] = [
            'assets/px.jpg', 'assets/nx.jpg', 'assets/py.jpg', 'assets/ny.jpg', 'assets/pz.jpg', 'assets/nz.jpg',
        ];
        public static get referenceEquiRectangular(): ICartographic { return _referenceEquiRectangular; }
        public static set referenceEquiRectangular(value: ICartographic) {
            let updated = false;
            for (let attribute in value) {
                if (_referenceEquiRectangular.hasOwnProperty(attribute)) {
                    updated = true;
                    _referenceEquiRectangular[attribute] = value[attribute];
                }
            }
            if (updated) {
                _referenceEquiRectangularFloat32Array[0] = _referenceEquiRectangular.longitude;
                _referenceEquiRectangularFloat32Array[1] = _referenceEquiRectangular.latitude;
                _referenceEquiRectangularFloat32Array[2] = _referenceEquiRectangular.height;
                fireEvents('referenceEquiRectangular', _referenceEquiRectangular);
            }
        }

        public static get referenceEquiRectangularArray(): Float32Array { return _referenceEquiRectangularFloat32Array; }

        public static get THREE_EARTH_RADIUS(): number { return _THREE_EARTH_RADIUS; }
        public static set THREE_EARTH_RADIUS(value: number) { _THREE_EARTH_RADIUS = value; fireEvents('THREE_EARTH_RADIUS', value); }
        public static get TWEEN_TIMING(): number { return _TWEEN_TIMING; }
        public static set TWEEN_TIMING(value: number) { _TWEEN_TIMING = value; fireEvents('TWEEN_TIMING', value); }
        public static get lambda0Mercator(): number { return _lambda0Mercator; }
        public static set lambda0Mercator(value: number) { _lambda0Mercator = value; fireEvents('lambda0Mercator', value); }
        public static get year(): string { return _year; }
        public static set year(value: string) { _year = value; fireEvents('year', value); }

        public static get projectionInit(): PROJECTION_ENUM { return _projectionInit; }
        public static set projectionInit(value: PROJECTION_ENUM) {
            _projectionInit = value;
            fireEvents('projectionBegin', _projectionInit);
        }
        public static get projectionEnd(): PROJECTION_ENUM { return _projectionEnd; }
        public static set projectionEnd(value: PROJECTION_ENUM) {
            _projectionEnd = value;
            fireEvents('projectionEnd', _projectionEnd);
        }
        public static get percentProjection(): number { return _projectionPercent; }
        public static set percentProjection(value: number) {
            if (value >= 0 && value <= 100) {
                _projectionPercent = value;
                fireEvents('projectionPercent', value);
            }
        }

        public static addEventListener(events: string, callBack: configurationCallback, uuid = generateUUID(), scope?: any): string {
            let eventNames = events.split(' ');
            eventNames.forEach((name) => {
                if (_listeners.hasOwnProperty(name)) {
                    (<IEventListItem[]>_listeners[name]).push({ cb: callBack, scope: scope, uuid: uuid });
                }
            });
            return uuid;
        }
        public static removeEventListener(uuid: string): void {
            let list: IEventListItem[];
            let i: number;
            for (let evName in _listeners) {
                if (_listeners.hasOwnProperty(evName)) {
                    list = _listeners[evName];
                    for (let i = list.length - 1; i >= 0; i--) {
                        if (list[i].uuid === uuid) {
                            list.splice(i, 1);
                        }
                    }
                }
            }
        }

        public static tick(): void {
            fireEvents('tick', 0);
        }
    }

    Configuration.coneStep = 15 * Configuration.deg2rad;
    Configuration.heightRatio = 0.01;
    Configuration.intrudedHeightRatio = 0.6;
    Configuration.TWEEN_TIMING = 1000;
    Configuration.THREE_EARTH_RADIUS = 100;
}
