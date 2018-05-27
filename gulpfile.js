/* jslint node: true */
// allow 'require' global
'use strict';

let gulp = require('gulp'),
  concat = require('gulp-concat'),
  del = require('del'),
  ts = require('gulp-typescript'),
  rename = require('gulp-rename'),
  babel = require('gulp-babel'),
  shell = require('gulp-shell'),
  addsrc = require('gulp-add-src'),
  connect = require('gulp-connect'),
  typedoc = require('gulp-typedoc'),
  clone = require('gulp-clone'),
  flatmap = require('gulp-flatmap'),
  insert = require('gulp-insert'),
  argv = require('yargs').argv,
  glsl = require('glslify');

let sources = {
  app: {
    ts: [
      'node_modules/@types/**/*.d.ts', 'node_modules/poly2tri/src/poly2tri.d.ts', './src/**/**/*.ts', '!./src/webWorkers/**/*.ts'
    ],
    tsWorker: ['./src/webWorkers/**/*.ts'],
    shader: [
      './src/shaders/**/*.frag', './src/shaders/**/*.vert'
    ],
    common: [
      'node_modules/@types/**/*.d.ts', './src/common/*.ts', './src/definitions/*.ts', './src/shaders.ts'
    ],
    appThirdParty: [
      'node_modules/three/build/three.js',
      'node_modules/three/examples/js/libs/stats.min.js',
      'node_modules/three/examples/js/Detector.js',
      'node_modules/three/examples/js/controls/OrbitControls.js',
      'node_modules/tween.js/src/Tween.js',
      'node_modules/poly2tri/dist/poly2tri.js',
      'node_modules/papaparse/papaparse.js',
      'node_modules/twgl.js/dist/4.x/twgl.js'
    ],
    workerThirdParty: [
        'node_modules/twgl.js/dist/4.x/twgl.js'
      ]
  }
};

let destinations = {
  js: {
    dist: 'dist',
    example: 'example/javascript'
  }
};

let isProduction = argv.testing === true ? false : true;

let workers = {};

let shaders = {};

let libraries = {};

gulp.task('workers', ['shaders'], function() {
  return gulp.src(sources.app.tsWorker).pipe(flatmap(function(stream, file) {
    let name = file.relative.toString().replace('.ts', '');
    let top = name + '.js';
    workers[name] = {};
    stream = stream.pipe(addsrc.prepend(sources.app.common)).pipe(ts({
      declaration: false,
      noResolve: true,
      target: 'ES6',
      noResolve: true,
      removeComments: true,
      outFile: top,
      //lib:['webworker','es6','scripthost']
    })).js.pipe(concat(top)).pipe(insert.transform(function(contents) {
      workers[name]['debug'] = JSON.stringify(contents);
      return contents;
    }));

    if (isProduction === true) {
      stream = stream.pipe(babel({presets: ['babili'], compact: true, minified: true, comments: false})).pipe(insert.transform(function(contents) {
        workers[name]['min'] = JSON.stringify(contents);
        return contents;
      }));
    }
    return stream;
  }));
});

gulp.task('libraries', function() {
  return gulp.src(sources.app.workerThirdParty).pipe(flatmap(function(stream, file) {
    let name = file.relative;
    libraries[name] = {};
    libraries[name].debug=JSON.stringify(file.contents.toString());

    if (isProduction === true) {
      stream = stream.pipe(babel({presets: ['babili'], compact: true, minified: true, comments: false})).pipe(insert.transform(function(contents) {
        libraries[name].min = JSON.stringify(contents);
        return contents;
      }));
    }
    return stream;
  }));
});

gulp.task('shaders', function() {
  return gulp.src(sources.app.shader).pipe(flatmap(function(stream, file) {
    let fileString = file.relative.toString();
    let typeShader = fileString.endsWith('vert')
      ? 'vertex'
      : 'fragment';
    let name = fileString.replace('.frag', '').replace('.vert', '');
    stream.pipe(insert.transform(function(contents) {
      if (!shaders.hasOwnProperty(name)) {
        shaders[name] = {};
      }
      let src = commentStripper(glsl.compile(contents));
      shaders[name][typeShader] = src;
      return contents;
    }));
    return stream;
  }));
});

gulp.task('build', [ 'workers', 'shaders', 'libraries' ], function() {
  let tsStream = gulp.src(sources.app.ts).pipe(ts({declaration: true, noResolve: true, target: 'ES6', outFile: 'shriveling.js', removeComments: true}));
  let debugStream = tsStream.js.pipe(addsrc.prepend(sources.app.appThirdParty)).pipe(concat('shriveling.js'));

  let minStream;
  if (isProduction === true) {
    minStream = debugStream.pipe(clone());
  }
  for (let workerName in workers) {
    if (workers.hasOwnProperty(workerName)) {
      let workerStringDebug = '\nshriveling.Workers.workerList.' + workerName + '=' + workers[workerName].debug + ';';
      debugStream = debugStream.pipe(insert.transform(function(contents) {
        return contents + workerStringDebug;
      }));
      if (isProduction === true) {
        let workerStringMin = '\nshriveling.Workers.workerList.' + workerName + '=' + workers[workerName].min + ';';
        minStream = minStream.pipe(insert.transform(function(contents) {
          return contents + workerStringMin;
        }));
      }
    }
  }

  for (let shaderName in shaders) {
    if (shaders.hasOwnProperty(shaderName)) {
      let shaderString = '\nshriveling.Shaders.shaderList.' + shaderName + '=' + JSON.stringify(shaders[shaderName]) + ';';
      debugStream = debugStream.pipe(insert.transform(function(contents) {
        return contents + shaderString;
      }));
      if (isProduction === true) {
        minStream = minStream.pipe(insert.transform(function(contents) {
          return contents + shaderString;
        }));
      }
    }
  }

  for(let librarieName in libraries){
    if (libraries.hasOwnProperty(librarieName)) {
      let librarieStringDebug = '\nshriveling.Workers.libraryList["' + librarieName + '"]=' + libraries[librarieName].debug + ';';
      debugStream = debugStream.pipe(insert.transform(function(contents) {
        return contents + librarieStringDebug;
      }));
      if (isProduction === true) {
        let librarieStringMin = '\nshriveling.Workers.libraryList["' + librarieName + '"]=' + libraries[librarieName].min + ';';
        minStream = minStream.pipe(insert.transform(function(contents) {
          return contents + librarieStringMin;
        }));
      }
    }
  }

  debugStream.pipe(gulp.dest(destinations.js.dist)).pipe(gulp.dest(destinations.js.example));
  if (isProduction === true) {
    minStream.pipe(babel({presets: ['babili'], compact: true, minified: true, comments: false})).pipe(rename('shriveling.min.js')).pipe(gulp.dest(destinations.js.dist)).pipe(gulp.dest(destinations.js.example));
  }

  return tsStream.dts.pipe(gulp.dest(destinations.js.dist)).pipe(rename('shriveling.d.ts')).pipe(gulp.dest(destinations.js.dist));
});

gulp.task('tslint', shell.task('tslint -c tslint.json -e src/webWorkers/**/*.ts src/**/**/*.ts src/*.ts'));

gulp.task('clean', function() {
  return del.sync(['dist', 'example/javascript/', 'src/**/*.js']);
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

gulp.task('default', ['clean', 'tslint', 'build']);

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
