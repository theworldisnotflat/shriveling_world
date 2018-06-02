'use strict';
import { ShaderTypes } from './definitions/project';
export class Shaders {
    private static shaderList: { [name: string]: { [typo: string]: string } } | string = '__SHADERS_HERE__';
    public static getShader(name: string, typo: ShaderTypes): string {
        let resultat: string = '';
        let corps = Shaders.shaderList[name];
        if (corps !== undefined && corps[typo] !== undefined) {
            resultat = corps[typo];
        }
        return resultat;
    }
}
