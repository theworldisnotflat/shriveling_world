'use strict';

const rollup = require('rollup');
const terser = require('rollup-plugin-terser').terser;
const typescript = require('rollup-plugin-typescript2');
const svelte = require('rollup-plugin-svelte');
const commonjs = require('@rollup/plugin-commonjs');
const {nodeResolve} = require('@rollup/plugin-node-resolve');
const json = require('@rollup/plugin-json');
const glob = require('glob');
const { readdirSync, readFileSync, outputFile, createWriteStream, ensureDir } = require('fs-extra');
const stripDebug = require('strip-debug');
const { src, dest, watch, series, parallel, task } = require('gulp');
const del = require('del');
const shell = require('gulp-shell');
const connect = require('gulp-connect');
const argv = require('yargs').argv;
const glsl = require('glslify');
const { createDeflate } = require('zlib');
const { Readable } = require('stream');

let sources = {
	app: {
		shader: ['./src/shaders/**/*.frag', './src/shaders/**/*.vert'],
		template: ['./templates/app/**/**.*'],
		src: './src/**/**/*.*',
	},
	datasets: './datasets/',
	blog: {
		watch: ['./templates/blog/content/documentation/**/*.*', '!./templates/blog/public/**/**/*.*'],
		content: './templates/blog/public/**/**/**/*.*',
	},
};

let destinations = {
	pages: 'pages/',
	js: {
		dist: 'dist/*.js',
		get example() {
			return destinations.app + 'javascript/';
		},
	},
	get app() {
		return destinations.pages + 'app/';
	},
	doc: { html: 'documentation/html/', json: 'documentation/json/' },
	get datasets() {
		return destinations.app + 'datasets/';
	},
	get blog() {
		return destinations.pages;
	},
};

const rollupPlugins = [
	json(),
	nodeResolve({ browser: true, preferBuiltins: false }),
	commonjs({
		include: /node_modules/,
		ignoreGlobal: false,
		sourceMap: false,
	}),
	typescript({ useTsconfigDeclarationDir: true }),
];
const rollupFormat = 'iife';
let isProduction = argv.testing === true ? false : true;

let isDebugging = argv.debug === true ? true : false;
if (argv._[0] === 'dev') {
	isProduction = false;
	isDebugging = true;
}
const baseURL=isProduction?'https://theworldisnotflat.github.io/shriveling_world_documentation/': 'http://127.0.0.1:8080/'
let shaders = {};

let libraries = {};

function commentStripper(contents) {
	let newContents = [];
	for (let i = 0; i < contents.length; ++i) {
		let c = contents.charAt(i);
		if (c === '/') {
			c = contents.charAt(++i);
			if (c === '/') {
				while (c !== '\r' && c !== '\n' && i < contents.length) {
					c = contents.charAt(++i);
				}
			} else if (c === '*') {
				while (i < contents.length) {
					c = contents.charAt(++i);
					if (c === '*') {
						c = contents.charAt(++i);
						while (c === '*') {
							c = contents.charAt(++i);
						}
						if (c === '/') {
							c = contents.charAt(++i);
							break;
						}
					}
				}
			} else {
				--i;
				c = '/';
			}
		}
		newContents.push(c);
	}

	newContents = newContents.join('');
	newContents = newContents
		.replace(/\s+$/gm, '')
		.replace(/^\s+/gm, '')
		.replace(/\n+/gm, '\n');
	return newContents;
}

function glob2Array(inputs) {
	const files = [];
	inputs.forEach(path => {
		files.push(...glob.sync(path,{nodir:true}));
	});
	return files;
}

const getDirectories = source =>
	readdirSync(source, { withFileTypes: true })
		.filter(dirent => dirent.isDirectory())
		.map(dirent => dirent.name);

const folder2dict = source => {
	let result = [];
	readdirSync(source, { withFileTypes: true })
		.filter(dirent => !dirent.isDirectory())
		.map(dirent => dirent.name)
		.forEach(name => {
			result.push({
				name: name,
				text: readFileSync(source + '/' + name, {
					encoding: 'utf8',
				}),
			});
		});
	return result;
};

const cleaner = listToClean => done => {
	del.sync(listToClean);
	done();
};

const cleanTemp = cleaner(['temp']);
const cache = {};

const compileShaders = async done => {
	const shadersFiles = glob2Array(sources.app.shader);
	await Promise.all(
		shadersFiles.map(async file => {
			let typeShader = file.endsWith('vert') ? 'vertex' : 'fragment';
			let last = file.split('/');
			let name = last[last.length - 1].replace('.frag', '').replace('.vert', '');
			let fileContent = readFileSync(file, 'utf8');
			if (!shaders.hasOwnProperty(name)) {
				shaders[name] = {};
			}
			shaders[name][typeShader] = commentStripper(glsl.compile(fileContent));
		})
	);
	done();
};

const build = async done => {
	let { shadersString, librariesString } = {
		shadersString: JSON.stringify(shaders),
		librariesString: JSON.stringify(libraries),
	};
	if (isProduction) {
		rollupPlugins.push(terser({ ecma: 7 }));
	}
	const bundle = await rollup.rollup({
		input: 'src/bigBoard/bigBoard.ts',
		cache: cache,
		plugins: rollupPlugins,
	});
	const outputOptions = {
		file: 'dist/shriveling.js',
		format: rollupFormat,
		name: 'shriveling',
	};
	await bundle.write(outputOptions);
	let code = await bundle.generate(outputOptions);
	code = code.output[0].code;
	code = !isProduction && isDebugging ? code : stripDebug(code).toString();
	code = code.replace(/.__SHADERS_HERE__./, shadersString).replace(/.__LIBRARIES_HERE__./, librariesString);
	await outputFile(__dirname + '/dist/shriveling.js', code);
	done();
};

const convertMD = async done => {
	const mds = glob2Array(['temp/**/**.md']);
	let reg = /\[([^\]]+)\]\(([^\)]+)\)/g; // 4070
	// let reg2 = /\[(.*?)\]\((.+?)\)/g; // 4069
	const changer = (chn, p1, p2) => {
		return p2.includes('http') ? chn : chn.replace(p2, `{{< ref "${p2}" >}}`);
	};
	del.sync(['templates/blog/content/documentation/']);
	const frontmatter = () =>
		'+++\ntitle = "documentation"\ndate = "' +
		new Date().toISOString() +
		'"\ndraft = "false"\ntags = ["documentation"]\ncategories = []\n+++\n';
	await Promise.all(
		mds.map(async md => {
			let fileContent = frontmatter() + readFileSync(md, 'utf8');
			md = md.replace('temp/', '');
			await outputFile(
				__dirname + '/templates/blog/content/documentation/' + md,
				fileContent.replace(reg, changer)
			);
			return fileContent;
		})
	);
	cleanTemp(done);
};

const doc = series(
	cleanTemp,
	shell.task(
		'npx typedoc --plugin typedoc-plugin-markdown --out temp --json temp/json.json  --readme none  --name "shriveling the world documentation" --ignoreCompilerErrors --hideGenerator --target ES6  src'
	),
	convertMD
);

const lint = shell.task('npm run lint');

const hugoGeneration = shell.task(`cd templates/blog && ../../node_modules/.bin/hugo -D --debug -b "${baseURL}"`, {
	verbose: true,
});


const hugoCopy = async done => {
	src(sources.blog.content)
		// .pipe(replace(regex, '$1/$3'))
		.pipe(dest(destinations.blog))
		.pipe(connect.reload());
	done();
};

const clone = shell.task('git clone https://github.com/thingsym/hugo-theme-techdoc.git templates/blog/themes/techdoc');

const postinstall = async done => {
	const dropThemes = cleaner(['templates/blog/themes']);
	await dropThemes(() => {});
	clone(done);
};

const hugoRequirements = series(hugoGeneration, hugoCopy);

const fullClean = cleaner([
	'dist',
	'pages',
	'src/**/*.js',
	'!src/IHM/**/*.js',
	'declarations',
	'example/css/',
	'template/blog/public',
	'temp',
	'templates/blog/content/documentation/',
]);

const server = () =>
	connect.server({
		root: destinations.pages,
		port: 8080,
		livereload: true,
		https: false,
	});

const defaultTask = done => {
	src(destinations.js.dist)
		.pipe(dest(destinations.js.example))
		.pipe(connect.reload());
	src(sources.app.template)
		.pipe(dest(destinations.app))
		.pipe(connect.reload());
	done();
};

const zipper = async done => {
	let datasets = getDirectories('datasets');
	await ensureDir(__dirname + '/' + destinations.datasets);
	await Promise.all(
		datasets.map(directory => {
			let datas = JSON.stringify(folder2dict('datasets/' + directory + '/'));
			const readableStream = new Readable();
			readableStream._read = () => {};

			let deflate = createDeflate({ level: 9 });
			readableStream.push(datas, 'utf8');
			readableStream.push(null);
			readableStream.pipe(deflate).pipe(createWriteStream(__dirname + '/' + destinations.datasets + directory));
		})
	);
	outputFile(__dirname + '/' + destinations.datasets + 'datasets.json', JSON.stringify(datasets));
	done();
};

const svelteBundle = async done => {
	const bundle = await rollup.rollup({
		input: 'src/IHM/main.js',
		plugins: [
			svelte({
				css: css => css.write('example/css/ihm.css'),
			}),
			isProduction && terser({ ecma: 7 }),
		],
	});
	await bundle.write({
		file: 'example/javascript/ihm.js',
		format: 'iife',
		name: 'ihm',
	});
	done();
};

const buildRequirements = series(parallel(compileShaders, zipper), build);

const defaultRequirement = series(
	parallel(fullClean, lint),
	doc,
	parallel(buildRequirements, hugoRequirements),
	defaultTask
);

const devDefault = series(lint, series(buildRequirements, doc), defaultTask);

const watchFiles = () => {
	watch(sources.blog.watch, hugoRequirements);
	watch([...sources.app.shader, ...sources.app.template, sources.datasets, sources.app.src], devDefault);
	series(fullClean, defaultRequirement, hugoRequirements)();
};

const devRequirements = parallel(watchFiles,server);

exports.svelte = svelteBundle;
exports.fullClean = fullClean;
exports.server = server;
exports.doc = doc;
exports.hugo = hugoRequirements;
exports.default = defaultRequirement;
exports.dev = devRequirements;
exports.postinstall = postinstall;
