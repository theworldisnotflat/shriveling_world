'use strict';

const rollup = require('rollup');
const terser = require('rollup-plugin-terser').terser;
const typescript = require('rollup-plugin-typescript2');
const svelte = require('rollup-plugin-svelte')
const commonjs = require('@rollup/plugin-commonjs');
const resolve = require('@rollup/plugin-node-resolve');
const json = require( '@rollup/plugin-json');
const glob = require("glob");
const {readdirSync,readFileSync,readFile,outputFile} = require('fs-extra');
const uglify = require("uglify-es");
const typedoc = require("gulp-typedoc");
const Zip = require( 'zip-lib');

let gulp = require('gulp'),
  del = require('del'),
  shell = require('gulp-shell'),
  connect = require('gulp-connect'),
  argv = require('yargs').argv,
  glsl = require('glslify');

let sources = {
  app: {
    shader: [
      './src/shaders/**/*.frag', './src/shaders/**/*.vert'
    ],
    /**
     * This is where external libraries are declared
     * Each new library must also be declared in the package.json file
     * by the instruction 'npm i -D  XXX' where XXX is the name of the library
     * Beware : the order of insertion is important, i.e. libraries using
     * three.js must be inserter AFTER the three.js line
     */
    appThirdParty: [
      'node_modules/papaparse/papaparse.js',
    ],
    template:'templates/app/**/**.*'
  },
  datasets:'datasets/'
};

let destinations = {
  js: {
    dist: 'dist/*.js',
    get example() {return destinations.app+'javascript/'}
  },
  app:'pages/app/',
  doc:{html:'documentation/html',json:'documentation/json'},
  get datasets(){ return destinations.app+'datasets/'}
};

const rollupExternal = ['papaparse'];
const rollupGlobal = {
  'papaparse': 'Papa'
};
const rollupPlugins = [
  json(),
  resolve({browser:true,preferBuiltins:false}),
  commonjs({include: /node_modules/, ignoreGlobal: false, sourceMap: false}),
  typescript({useTsconfigDeclarationDir: true})
];
const rollupFormat = 'iife';
let isProduction = argv.testing === true
  ? false
  : true;

if (isProduction) {
  rollupPlugins.push(terser({ecma: 7}));
}

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
  newContents = newContents.replace(/\s+$/gm, '').replace(/^\s+/gm, '').replace(/\n+/gm, '\n');
  return newContents;
}

function glob2Array(inputs) {
  const files = [];
  inputs.forEach((path) => {
    files.push(...glob.sync(path))
  });
  return files;
}

const getDirectories = (source) =>
  readdirSync(source, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

const cache = {};
let externalLibraries = '';

const compileShaders = async (done) => {
  const shadersFiles = glob2Array(sources.app.shader);
  await Promise.all(shadersFiles.map(async (file) => {
    let typeShader = file.endsWith('vert')
      ? 'vertex'
      : 'fragment';
    let last = file.split('/');
    let name = last[last.length - 1].replace('.frag', '').replace('.vert', '');
    let fileContent = readFileSync(file, 'utf8');
    if (!shaders.hasOwnProperty(name)) {
      shaders[name] = {};
    }
    shaders[name][typeShader] = commentStripper(glsl.compile(fileContent));
  }));
  done();
};

const combineExternals = async (done) => {
  let temp = await Promise.all(sources.app.appThirdParty.map(async (file) => {
    let fileContent = await readFile(file, 'utf8');
    if (isProduction) {
      fileContent = uglify.minify(fileContent, {ecma: 7}).code;
    }
    return fileContent;
  }))
  externalLibraries = temp.join('\n') + '\n';
  done();
};

const build = async (done) => {
  let {shadersString, librariesString} = {
    shadersString: JSON.stringify(shaders),
    librariesString: JSON.stringify(libraries)
  };
  const bundle = await rollup.rollup({input: 'src/bigBoard/bigBoard.ts', cache: cache, plugins: rollupPlugins, external: rollupExternal});
  const outputOptions = {
    file: 'dist/shriveling.js',
    format: rollupFormat,
    name: 'shriveling',
    globals: rollupGlobal
  }
  await bundle.write(outputOptions);
  let code = await bundle.generate(outputOptions);
  // console.log(code.output[0].code)
  code = externalLibraries + code.output[0].code.replace(/.__SHADERS_HERE__./, shadersString).replace(/.__LIBRARIES_HERE__./, librariesString);
  await outputFile(__dirname + '/dist/shriveling.js', code);
  done();
};

const doc= shell.task('typedoc --out documentation/html --json documentation/json.json --name "shriveling the world" --ignoreCompilerErrors --hideGenerator --target ES6  src')
const tslint = shell.task('tslint -c tslint.json -e src/webWorkers/**/*.ts src/**/**/*.ts src/*.ts');
const clean = (done) => {
  del.sync(['dist', 'pages', 'src/**/*.js','!src/IHM/**/*.js', 'declarations', 'documentation','example/css/']);
  done();
}
const server = () => connect.server({root: destinations.app, port: 8080, livereload: true, https: false});
const defaultTask = (done) => {
  gulp.src(destinations.js.dist).pipe(gulp.dest(destinations.js.example));
  gulp.src(sources.app.template).pipe(gulp.dest(destinations.app));
  done();
};
const zipper= async done=>{
  await Promise.all(getDirectories('datasets').map((directory,i)=> {
    Zip.archiveFolder(sources.datasets+directory,destinations.datasets+directory+'.zip')
  }));
  done();
}
const svelteBundle= async (done)=>{

  const bundle= await rollup.rollup({
    input:'src/IHM/main.js',
    plugins:[
      svelte({
          css:css=>css.write('example/css/ihm.css')
        }),
         isProduction && terser({ecma: 7})
    ]});
    await bundle.write({
      file: 'example/javascript/ihm.js',
      format: 'iife',
      name: 'ihm'
    });
    done();
  }
const buildRequirements = gulp.series(gulp.parallel(compileShaders,/* compileLibraries,*/ combineExternals), build);
const defaultRequirement = gulp.series(gulp.parallel(clean, tslint), buildRequirements, defaultTask);

gulp.task('zip',zipper);

gulp.task('build', buildRequirements);

gulp.task('svelte',svelteBundle)

// gulp.task('libraries', compileLibraries);

gulp.task('externals', combineExternals);

gulp.task('shaders', compileShaders);

gulp.task('tslint', tslint);

gulp.task('clean', clean);

gulp.task('server', server);

gulp.task('doc', doc);

gulp.task('default', defaultRequirement);
