namespace shriveling {
    'use strict';
    export type ShaderTypes = 'fragment' | 'vertex';
    export class Shaders {
        private static shaderList: { [name: string]: { [typo: string]: string } } = {};
        public static getShader(name: string, typo: ShaderTypes): string {
            let resultat: string = '';
            let corps = Shaders.shaderList[name];
            if (corps !== undefined && corps[typo] !== undefined) {
                resultat = corps[typo];
            }
            return resultat;
        }
    }
}
