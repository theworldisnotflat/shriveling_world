'use strict';

const rollup = require('rollup');
const terser = require('rollup-plugin-terser').terser;
const typescript = require('rollup-plugin-typescript2');
const commonjs = require('rollup-plugin-commonjs');
const nodeResolve = require('rollup-plugin-node-resolve');
const threeLegacyImport =require('rollup-plugin-threejs-legacy-import');
const glob = require("glob");
const fs = require('fs-extra');
const uglify = require("uglify-es");
const typedoc = require("gulp-typedoc");

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
    // This is where external libraries are declared
    // Each new library must also be declared in the package.json file
    // by the instruction 'npm i -D  XXX' where XXX is the name of the library
    // Beware : the order of insertion is important, i.e. libraries using
    // three.js must be inserter AFTER the three.js line
    appThirdParty: [
      'node_modules/twgl.js/dist/4.x/twgl.js',
      'node_modules/three/build/three.js',
      'node_modules/three/examples/js/libs/stats.min.js',
      'node_modules/three/examples/js/controls/OrbitControls.js',
      'node_modules/three/examples/js/exporters/OBJExporter.js',
      'node_modules/tween.js/src/Tween.js',
      'node_modules/poly2tri/dist/poly2tri.js',
      'node_modules/papaparse/papaparse.js',
      'node_modules/dat.gui/build/dat.gui.js'
    ],
    workerThirdParty: ['node_modules/twgl.js/dist/4.x/twgl.js'],
    // three.js comes with lots of little plugins in examples folder. In order
    // to reuse these plugins, we need to explicit it here.
    threeExplicitExports:{
      'controls/OrbitControls':['OrbitControls'],
      'exporters/OBJExporter':['OBJExporter']}
  }
};

let destinations = {
  js: {
    dist: 'dist/*.js',
    example: 'example/javascript'
  },
  doc:{html:'documentation/html',json:'documentation/json'}
};

const rollupExternal = ['three', 'papaparse', 'poly2tri', 'twgl.js', 'dat.gui'];
const rollupGlobal = {
  'three': 'THREE',
  'papaparse': 'Papa',
  'poly2tri': 'poly2tri',
  'twgl.js': 'twgl',
  'dat.gui': 'dat'
};
const rollupPlugins = [
  commonjs({include: /node_modules/, ignoreGlobal: false, sourceMap: false}),
  threeLegacyImport({  explicitExports:sources.app.threeExplicitExports}),
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
  var newContents = [];
  for (var i = 0; i < contents.length; ++i) {
    var c = contents.charAt(i);
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
    let fileContent = fs.readFileSync(file, 'utf8');
    if (!shaders.hasOwnProperty(name)) {
      shaders[name] = {};
    }
    shaders[name][typeShader] = commentStripper(glsl.compile(fileContent));
  }));
  done();
};

const compileLibraries = async (done) => {
  const librariesFiles = glob2Array(sources.app.workerThirdParty);
  await Promise.all(librariesFiles.map(async (file) => {
    let last = file.split('/');
    let name = last[last.length - 1].replace('.ts', '');
    let fileContent = fs.readFileSync(file, 'utf8');
    if (isProduction) {
      fileContent = uglify.minify(fileContent, {ecma: 7}).code;
    }
    libraries[name] = fileContent;
  }));
  done();
};

const combineExternals = async (done) => {
  let temp = await Promise.all(sources.app.appThirdParty.map(async (file) => {
    let fileContent = await fs.readFile(file, 'utf8');
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
  await fs.outputFile(__dirname + '/dist/shriveling.js', code);
  done();
};

const doc= shell.task('typedoc --out documentation/html --json documentation/json.json --name "shriveling the world" --ignoreCompilerErrors --hideGenerator --target ES6 --excludeExternals  --umlLocation remote --umlFormat svg  src')
const tslint = shell.task('tslint -c tslint.json -e src/webWorkers/**/*.ts src/**/**/*.ts src/*.ts');
const clean = (done) => {
  del.sync(['dist', 'example/javascript/', 'src/**/*.js', 'declarations', 'documentation']);
  done();
}
const server = () => connect.server({root: 'example', port: 8080, livereload: true, https: false});
const defaultTask = (done) => {
  gulp.src(destinations.js.dist).pipe(gulp.dest(destinations.js.example));
  done();
};
const buildRequirements = gulp.series(gulp.parallel(compileShaders, compileLibraries, combineExternals), build);
const defaultRequirement = gulp.series(gulp.parallel(clean, tslint/*,doc*/), buildRequirements, defaultTask);

gulp.task('build', buildRequirements);

gulp.task('libraries', compileLibraries);

gulp.task('externals', combineExternals);

gulp.task('shaders', compileShaders);

gulp.task('tslint', tslint);

gulp.task('clean', clean);

gulp.task('server', server);

gulp.task('default', defaultRequirement);
