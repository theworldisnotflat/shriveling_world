import path from 'path';
import fs from 'fs';
import showdown from 'showdown';

const getPost = (fileName: string) => fs.readFileSync(path.resolve('markdown', `${fileName}.md`), 'utf-8');
const converter = new showdown.Converter({
	omitExtraWLInCodeBlocks: true,
	ghCompatibleHeaderId: true,
	parseImgDimensions: true,
	simplifiedAutoLink: true,
	tables: true,
	simpleLineBreaks: true,
	ghMentions: true,
	metadata: true,
});
converter.setFlavor('github');

export function get(req, res) {
	const { slug } = req.params;
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
