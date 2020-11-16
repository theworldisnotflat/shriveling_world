'use strict';
import { ShaderTypes } from './definitions/project';

const shaderList: { [name: string]: { [typo: string]: string } } | string = '__SHADERS_HERE__';
export function getShader(name: string, typo: ShaderTypes): string {
	let resultat = '';
	const corps = shaderList[name];
	if (corps[typo] !== undefined) {
		resultat = corps[typo];
	}

	return resultat;
}
