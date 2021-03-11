import path from 'path';
import fs from 'fs';
import showdown from 'showdown';
import type { request, ServerResponse } from 'http';

const getPost = (fileName: string) => fs.readFileSync(path.resolve('markdown', `${fileName}.md`), 'utf-8');
const classMap = {
	h1: 'title is-1',
	h2: 'title is-2',
	h3: 'title is-3',
	h4: 'title is-4',
	h5: 'title is-5',
	table: 'table is-bordered is-striped is-narrow is-hoverable is-fullwidth',
};

const bindings = Object.keys(classMap).map((key) => ({
	type: 'output',
	regex: new RegExp(`<${key}(.*)>`, 'g'),
	replace: `<${key} class="${classMap[key]}" $1>`,
}));

const converter = new showdown.Converter({
	omitExtraWLInCodeBlocks: true,
	ghCompatibleHeaderId: true,
	parseImgDimensions: true,
	simplifiedAutoLink: true,
	tables: true,
	simpleLineBreaks: true,
	ghMentions: true,
	metadata: true,
	extensions: [...bindings],
});
converter.setFlavor('github');

export function get(req: typeof request, res: ServerResponse): void {
	const { slug } = (<any>req).params;
	const content = getPost(slug.join('/'));
	const html = converter.makeHtml(content);
	if (html) {
		res.writeHead(200, {
			'Content-Type': 'application/json',
		});

		res.end(JSON.stringify({ html }));
	} else {
		res.writeHead(404, {
			'Content-Type': 'application/json',
		});

		res.end(
			JSON.stringify({
				message: `Not found`,
			})
		);
	}
}
