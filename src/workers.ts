namespace shriveling {
    'use strict';

    export class Workers {
        private static workerList: { [name: string]: string } = {};
        private static libraryList: { [name: string]: string } = {};
        public static generateWorker(name: string): Worker {
            let resultat: Worker;
            let corps = Workers.workerList[name];
            if (corps === undefined) {
                throw new Error('no worker with the name of ' + name);
            } else {
                let importFiles = corps.match(/importScripts\((.*)\).?;?/g);
                if (importFiles !== null) {
                    importFiles.map(st => st.match(/importScripts\((.*)\).?;?/)).forEach((tab) => {
                        let names = tab[1].replace(/('|"|\s)/g, '').split(',');
                        let input = tab.input;
                        let filesContent = '';
                        names.forEach((name) => {
                            filesContent += Workers.libraryList[name] + '\n';
                        });
                        corps = corps.replace(input, filesContent);
                    });
                }

                let shaderFiles = corps.match(/shriveling.Shaders.getShader\((.*),(.*)\)/g);
                if (shaderFiles !== null) {
                    shaderFiles
                        .map(st => st.match(/shriveling.Shaders.getShader\((.*),(.*)\)/))
                        .forEach((tab) => {
                            let name = tab[1].replace(/('|"|\s)/g, '');
                            let typeShader = <ShaderTypes>tab[2].replace(/('|"|\s)/g, '');
                            let input = tab.input;
                            let data = Shaders.getShader(name, typeShader);
                            corps = corps.replace(tab.input, JSON.stringify(data));
                        });
                }
                let blob = new Blob([corps], { type: 'application/javascript' });
                let blobURL = URL.createObjectURL(blob);
                resultat = new Worker(blobURL);
                URL.revokeObjectURL(blobURL);
            }
            return resultat;
        }
    }
}
