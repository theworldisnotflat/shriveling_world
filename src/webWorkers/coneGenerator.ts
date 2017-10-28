namespace shriveling {
    'use strict';

    const forbiddenAttributes = ['referential', 'layers', 'position', 'transports'];
    const nameProjections = [...Object.keys(mapProjectors)];

    function matchingBBox(pos: Cartographic, bboxes: IBBox[]): Cartographic[][] {
        return bboxes.filter((bboxe) => pos.latitude >= bboxe.minLat && pos.latitude <= bboxe.maxLat &&
            pos.longitude >= bboxe.minLong && pos.longitude <= bboxe.maxLong && Cartographic.isInside(pos, bboxe.boundary))
            .map((bboxe) => bboxe.boundary);
    }

    function getLocalLimits(
        boundaries: Cartographic[][], referential: NEDLocal): { clock: number, distance: number }[] {
        let allPoints: Coordinate[] = [];
        boundaries.forEach((boundary) => {
            boundary.forEach((position) => {
                allPoints.push(referential.cartographic2NED(position));
            });
        });
        let clockDistance = allPoints.map((pos) => {
            return { clock: Math.atan2(pos.y, pos.x), distance: Math.sqrt(pos.x * pos.x + pos.y * pos.y + pos.z * pos.z) };
        }).reduce(
            (result, current) => {
                let clockClass = Math.floor(current.clock / Configuration.coneStep) * Configuration.coneStep;
                result[clockClass] = result[clockClass] === undefined ? current.distance : Math.min(result[clockClass], current.distance);
                return result;
            },
            {});
        let resultat: { clock: number, distance: number }[] = [];
        for (let clockString in clockDistance) {
            if (clockDistance.hasOwnProperty(clockString)) {
                resultat.push({ clock: parseFloat(clockString), distance: clockDistance[clockString] });
            }
        }
        let length = resultat.length;
        let temp: { clock: number, distance: number };
        for (let i = 0; i < length; i++) {
            temp = resultat[i];
            resultat.push(
                { clock: temp.clock - Configuration.TWO_PI, distance: temp.distance },
                { clock: temp.clock + Configuration.TWO_PI, distance: temp.distance });
        }
        return resultat.sort((a, b) => a.clock - b.clock);
    }

    interface ICartographicLimits {
        withLimits: Cartographic[];
        withoutLimits: Cartographic[];
    }

    function direction2Cartographic(
        base: IDirection[], referential: NEDLocal, distanceMax: number,
        boundaryFunction: (clock: number) => number): ICartographicLimits {
        let resultat: ICartographicLimits = { withLimits: [], withoutLimits: [] };
        if (base.length > 0) {
            let maxClock = base[base.length - 1].clock;
            let minClock = base[0].clock;
            if (maxClock - minClock < Configuration.TWO_PI) {
                maxClock = minClock + Configuration.TWO_PI;
                base.push({ clock: maxClock, elevation: base[0].elevation });
            }
            let elevationFunction = extrapolator(base, 'clock', 'elevation');
            let elevation: number;
            let distance: number;
            let cosEl: number;
            for (let clock = minClock; clock < maxClock; clock += Configuration.coneStep) {
                elevation = elevationFunction(clock);
                cosEl = Math.cos(elevation);
                if (cosEl > 0) {
                    distance = Math.min(distanceMax, boundaryFunction(clock) / cosEl);
                } else {
                    distance = distanceMax;
                }
                resultat.withLimits.push(referential.project(clock, elevation, distance));
                resultat.withoutLimits.push(referential.project(clock, elevation, distanceMax));
            }
        }
        return resultat;
    }

    function generateYearCone(
        referential: NEDLocal, base: IDirection[], distance: number,
        boundaryFunction: (clock: number) => number): IPseudoGeometryPremises {
        interface IProjectorCartographic {
            [name: string]: number[];
        }
        let tempCarto: Cartographic;
        let summit = referential.cartoRef;
        let baseCartographic: ICartographicLimits = direction2Cartographic(base, referential, distance, boundaryFunction);
        const n = baseCartographic.withoutLimits.length;
        let uvs: { withLimits: number[], withoutLimits: number[] } = { withLimits: [], withoutLimits: [] };
        let centerDownWithLimits = new Cartographic(summit.longitude, summit.latitude, 0, true);
        let centerDownWithoutLimits = centerDownWithLimits.clone();
        let vertices: { withLimits: IProjectorCartographic, withoutLimits: IProjectorCartographic }
            = { withLimits: {}, withoutLimits: {} };
        let faces: { withLimits: number[], withoutLimits: number[] } = { withLimits: [], withoutLimits: [] };

        for (let j = 0; j < nameProjections.length; j++) {
            vertices.withLimits[nameProjections[j]] = [];
            vertices.withoutLimits[nameProjections[j]] = [];
        }

        function addVertice(position: Cartographic, withLimits: boolean): void {
            let selectedVerticeTabs = withLimits === true ? vertices.withLimits : vertices.withoutLimits;
            let selectedUVSTabs = withLimits === true ? uvs.withLimits : uvs.withoutLimits;
            let packs = position.toPack();
            for (let name in packs) {
                if (packs.hasOwnProperty(name) && selectedVerticeTabs.hasOwnProperty(name)) {
                    selectedVerticeTabs[name].push(...packs[name]);
                }
            }
            selectedUVSTabs.push(
                position.longitude * Configuration.OVER_TWO_PI + 0.5,
                position.latitude * Configuration.OVER_PI + 0.5,
            );
        }

        for (let i = 0; i < n; i++) {
            addVertice(baseCartographic.withLimits[i], true);
            centerDownWithLimits.height += baseCartographic.withLimits[i].height / n;

            addVertice(baseCartographic.withoutLimits[i], false);
            centerDownWithoutLimits.height += baseCartographic.withoutLimits[i].height / n;
        }

        let summitVector3 = summit.toPack();
        addVertice(summit, true);
        addVertice(summit, false);

        addVertice(centerDownWithLimits, true);
        addVertice(centerDownWithoutLimits, false);

        let ia: number, ib: number;
        for (let i = 0; i < n; i++) {
            ia = i; ib = (i + 1) % n;
            faces.withLimits.push(ia, ib, n);
            faces.withLimits.push(ia, ib, n + 1);

            faces.withoutLimits.push(ia, ib, n);
            faces.withoutLimits.push(ia, ib, n + 1);
        }
        let resultat: IPseudoGeometryPremises = {
            withLimits: {
                uv: (new Float32Array(uvs.withLimits)).buffer,
                index: (new Uint32Array(faces.withLimits)).buffer,
                vertices: {},
            },
            withoutLimits: {
                uv: (new Float32Array(uvs.withoutLimits)).buffer,
                index: (new Uint32Array(faces.withoutLimits)).buffer,
                vertices: {},
            },
        };

        for (let j = 0; j < nameProjections.length; j++) {
            resultat.withLimits.vertices[nameProjections[j]] = (new Float32Array(vertices.withLimits[nameProjections[j]])).buffer;
            resultat.withoutLimits.vertices[nameProjections[j]] = (new Float32Array(vertices.withoutLimits[nameProjections[j]])).buffer;
        }

        return resultat;
    }
    interface ICompleteData {
        payload: ILookupPseudoGeometryPremises;
        transferables: ArrayBuffer[];
    }
    function pseudoConeGenerator(
        referential: NEDLocal, base: { [year: string]: IDirection[] },
        boundaries: Cartographic[][], distance: number): ICompleteData {
        let limitFunction = extrapolator(getLocalLimits(boundaries, referential), 'clock', 'distance');
        let payload: ILookupPseudoGeometryPremises = {};
        let transferables: ArrayBuffer[] = [];
        for (let year in base) {
            if (base.hasOwnProperty(year)) {
                let intermed = generateYearCone(referential, base[year], distance, limitFunction);
                payload[year] = intermed;
                transferables.push(intermed.withLimits.uv);
                transferables.push(intermed.withLimits.index);
                transferables.push(intermed.withoutLimits.uv);
                transferables.push(intermed.withoutLimits.index);
                for (let j = 0; j < nameProjections.length; j++) {
                    transferables.push(intermed.withLimits.vertices[nameProjections[j]]);
                    transferables.push(intermed.withoutLimits.vertices[nameProjections[j]]);
                }
            }
        }
        return { payload: payload, transferables: transferables };
    }

    function conesGenerator(lookup: ILookupTownTransport, bboxes: IBBox[], distance: number, pool: PoolMessages): void {
        for (let cityCode in lookup) {
            if (lookup.hasOwnProperty(cityCode)) {
                let properties = {};
                let townTransport = lookup[cityCode];
                let referential = townTransport.referential;
                let transports = townTransport.transports;
                let boundaryGeometries = matchingBBox(referential.cartoRef, bboxes);

                for (let attribute in townTransport) {
                    if (townTransport.hasOwnProperty(attribute) && forbiddenAttributes.indexOf(attribute) === -1) {
                        properties[attribute] = townTransport[attribute];
                    }
                }
                let coneLookup: ILookupTownPseudoGeometryPremises
                    = { transports: {}, position: referential.cartoRef, otherProperties: properties, cityCode: cityCode };
                let transferableDatas: ArrayBuffer[] = [];

                for (let transport in transports) {
                    if (transports.hasOwnProperty(transport)) {
                        let intermed = pseudoConeGenerator(referential, transports[transport], boundaryGeometries, distance);
                        coneLookup.transports[transport] = intermed.payload;
                        transferableDatas.push(...intermed.transferables);
                    }
                }
                delete lookup[cityCode];
                pool.add(coneLookup, transferableDatas);
            }
        }
        pool.end();
    }

    export class PoolMessages {

        private _self: any;

        constructor(that: any) {
            this._self = that;
        }

        public add(cones: ILookupTownPseudoGeometryPremises, transferables: ArrayBuffer[]): void {
            this._self.postMessage({ action: 'cones', data: cones }, transferables);
        }

        public go(event: MessageEvent): void {
            let data = <IDataConeGeneratorIn>JSON.parse(event.data, reviver);
            conesGenerator(data.lookup, data.bboxes, data.distance, this);
        }

        public end(): void {
            this._self.postMessage({ action: 'end' });
            this._self.close();
        }
    }
}

self.addEventListener('message', (e) => {
    'use strict';
    let pool = new shriveling.PoolMessages(<any>self);
    pool.go(e);
});
