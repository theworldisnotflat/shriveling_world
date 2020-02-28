'use strict';
import { GUI } from './guiDAT';
import BigBoard from './bigBoard';
import { IListFile } from '../definitions/project';
import { inflate } from 'pako/lib/inflate';

export class dataSetManager {
    public constructor(bigBoard: BigBoard, gui: GUI) {
        this._initInteraction(bigBoard, gui);
    }
    private async _initInteraction(bigBoard: BigBoard, gui: GUI) {
        let tab = await fetch('datasets/datasets.json').then(re => re.json());
        let element = document.createElement('div');
        let innerHTML = '';
        tab.forEach((name: string) => {
            innerHTML += '<div data-name="' + name + '">' + name + '</div>';
        });
        element.innerHTML = innerHTML;
        document.body.appendChild(element);
        element.style.position = 'absolute';
        element.style.top = '50px';
        element.style.zIndex = '100';
        element.style.color = 'white';
        element.style.textShadow = '2px 2px 4px black';
        element.style.cursor = 'pointer';
        element.addEventListener('click', async event => {
            let name = (<HTMLElement>event.target).dataset.name;
            if (name !== undefined) {
                let zip = await fetch('datasets/' + name + '.zip').then(raw =>
                    raw.arrayBuffer().then(buf => new Uint8Array(buf))
                );
                let unzipped: IListFile[] = JSON.parse(
                    new TextDecoder('utf-8').decode(inflate(zip))
                );
                bigBoard.cleanCones();
                bigBoard.cleanCountries();
                gui.filesToInsert(unzipped);
            }
        });
    }
}
