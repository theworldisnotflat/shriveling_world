'use strict';

const rollup = require('rollup');
const minify = require('rollup-plugin-minify-es');
const typescript = require('rollup-plugin-typescript2');
const commonjs = require('rollup-plugin-commonjs');
const nodeResolve = require('rollup-plugin-node-resolve');
const glob = require("glob");
const fs = require('fs-extra');
const uglify = require("uglify-es");

let gulp = require('gulp'),
  del = require('del'),
  shell = require('gulp-shell'),
  connect = require('gulp-connect'),
  typedoc = require('gulp-typedoc'),
  argv = require('yargs').argv,
  glsl = require('glslify');

let sources = {
  app: {
    tsWorker: ['./src/webWorkers/**/*.ts'],
    shader: [
      './src/shaders/**/*.frag', './src/shaders/**/*.vert'
    ],
    appThirdParty: [
      'node_modules/twgl.js/dist/4.x/twgl.js',
      'node_modules/three/build/three.js',
      'node_modules/three/examples/js/libs/stats.min.js',
      'node_modules/three/examples/js/Detector.js',
      'node_modules/three/examples/js/controls/OrbitControls.js',
      'node_modules/tween.js/src/Tween.js',
      'node_modules/poly2tri/dist/poly2tri.js',
      'node_modules/papaparse/papaparse.js'
    ],
    workerThirdParty: ['node_modules/twgl.js/dist/4.x/twgl.js']
  }
};

let destinations = {
  js: {
    dist: 'dist/*.js',
    example: 'example/javascript'
  }
};

const rollupExternal = ['three', 'papaparse', 'poly2tri', 'twgl.js'];
const rollupGlobal = {
  'three': 'THREE',
  'papaparse': 'Papa',
  'poly2tri': 'poly2tri',
  'twgl.js': 'twgl'
};
const rollupPlugins = [
  typescript({useTsconfigDeclarationDir: true}),
  commonjs({include: /node_modules/, ignoreGlobal: false, sourceMap: false})
];
const rollupFormat = 'iife';
let isProduction = argv.testing === true
  ? false
  : true;

if (isProduction) {
  rollupPlugins.push(minify({ecma: 7}));
}

let workers = {};

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

gulp.task('build', [
  'shaders', 'libraries', 'workers', 'externals'
], async (done) => {
  let {shadersString, librariesString} = {
    shadersString: JSON.stringify(shaders),
    librariesString: JSON.stringify(libraries)
  };
  //préparation workers
  for (let att in workers) {
    workers[att] = workers[att].replace(/.__SHADERS_HERE__./, shadersString).replace(/.__LIBRARIES_HERE__./, librariesString);
  }
  const bundle = await rollup.rollup({input: 'src/bigBoard/bigBoard.ts', cache: cache, plugins: rollupPlugins, external: rollupExternal});
  const outputOptions = {
    dir: 'dist/',
    file: 'dist/shriveling.js',
    format: rollupFormat,
    name: 'shriveling',
    globals: rollupGlobal
  }
  await bundle.write(outputOptions);
  let {code, map} = await bundle.generate(outputOptions);
  code = externalLibraries + code.replace(/.__SHADERS_HERE__./, shadersString).replace(/.__LIBRARIES_HERE__./, librariesString).replace(/.'__WORKERS_HERE__'./, JSON.stringify(workers)).replace(/twgl_js/g, 'twgl');
  await fs.outputFile(__dirname + '/dist/shriveling.js', code);
});

gulp.task('workers', async (done) => {
  const workersFiles = glob2Array(sources.app.tsWorker);
  await Promise.all(workersFiles.map(async (file) => {
    let bundle = await rollup.rollup({input: file, cache: cache, plugins: rollupPlugins, external: rollupExternal});
    let last = file.split('/');
    let name = last[last.length - 1].replace('.ts', '');
    let outputOptions = {
      dir: 'dist/',
      file: 'dist/' + name + '.js',
      format: rollupFormat,
      name: name,
      globals: rollupGlobal
    }
    let {code, map} = await bundle.generate(outputOptions);
    workers[name] = code.replace(/twgl_js/g, 'twgl');;
  }));
});

gulp.task('libraries', async (done) => {
  const librariesFiles = glob2Array(sources.app.workerThirdParty);
  await Promise.all(librariesFiles.map(async (file) => {
    let last = file.split('/');
    let name = last[last.length - 1].replace('.ts', '');
    let fileContent = fs.readFileSync(file, 'utf8');
    if (isProduction) {
      fileContent = uglify.minify(fileContent, {ecma: 7}).code;
    }
    libraries[name] = fileContent;
  }))
});

gulp.task('externals', async (done) => {
  let temp = await Promise.all(sources.app.appThirdParty.map(async (file) => {
    let fileContent = await fs.readFile(file, 'utf8');
    if (isProduction) {
      fileContent = uglify.minify(fileContent, {ecma: 7}).code;
    }
    return fileContent;
  }))
  externalLibraries = temp.join('\n') + '\n';
});

gulp.task('shaders', async (done) => {
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
  }))
});

gulp.task('tslint', shell.task('tslint -c tslint.json -e src/webWorkers/**/*.ts src/**/**/*.ts src/*.ts'));

gulp.task('clean', function() {
  return del.sync(['dist', 'example/javascript/', 'src/**/*.js', 'declarations']);
});

gulp.task('doc', function() {
  return gulp.src(sources.app.ts).pipe(typedoc({
    target: "ES6",
    includeDeclarations: false,
    out: "dist/documentation",
    name: "shriveling documentation",
    ignoreCompilerErrors: false,
    version: false
  }));
});

gulp.task('server', function() {
  connect.server({root: 'example', port: 8080, livereload: true, https: false});
});

gulp.task('default', [
  'clean', 'tslint', 'build'
], (done) => {
  gulp.src(destinations.js.dist).pipe(gulp.dest(destinations.js.example));
});
