namespace shriveling {
    'use strict';

    export class Workers {
        private static workerList: { [name: string]: string } = {};
        public static generateWorker(name: string): Worker {
            let resultat: Worker;
            let corps = Workers.workerList[name];
            if (corps === undefined) {
                throw new Error('no worker with the name of ' + name);
            } else {
                let blob = new Blob([corps], { type: 'application/javascript' });
                let blobURL = URL.createObjectURL(blob);
                resultat = new Worker(blobURL);
                URL.revokeObjectURL(blobURL);
            }
            return resultat;
        }
    }
}
