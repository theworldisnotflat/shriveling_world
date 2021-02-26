import {
    readdirSync,
    readFileSync,
    outputFileSync,
    createWriteStream,
    ensureDirSync,
} from 'fs-extra';
import { Readable } from 'stream';
import { createDeflate } from 'zlib';

const datasetDestination = __dirname + '/static/datasets/';

function folder2dict(source) {
    let result = [];
    readdirSync(source, { withFileTypes: true })
        .filter((dirent) => !dirent.isDirectory())
        .map((dirent) => dirent.name)
        .forEach((name) => {
            result.push({
                name: name,
                text: readFileSync(source + '/' + name, {
                    encoding: 'utf8',
                }),
            });
        });
    return result;
}

function getDirectories(source) {
    return readdirSync(source, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name);
}

export function zipper() {
    let datasets = getDirectories(__dirname + '/datasets');
    ensureDirSync(datasetDestination);
    datasets.forEach((directory) => {
        let datas = JSON.stringify(folder2dict(__dirname + '/datasets/' + directory + '/'));
        const readableStream = new Readable();
        readableStream._read = () => {};

        let deflate = createDeflate({ level: 9 });
        readableStream.push(datas, 'utf8');
        readableStream.push(null);
        readableStream.pipe(deflate).pipe(createWriteStream(datasetDestination + directory));
    });
    outputFileSync(datasetDestination + 'datasets.json', JSON.stringify(datasets));
}