/*jslint node: true */
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
    argv = require('yargs').argv;
let sources = {
    app: {
        ts: [
            'typings/globals/**/*.d.ts', 'node_modules/@types/**/*.d.ts', './src/**/**/*.ts', '!./src/webWorkers/**/*.ts'
        ],
        tsWorker: ['./src/webWorkers/**/*.ts'],
        common: [
            'typings/globals/**/*.d.ts', 'node_modules/@types/**/*.d.ts', './src/common/*.ts'
        ],
        appThirdParty: [
            'node_modules/three/build/three.js',
            'node_modules/three/examples/js/libs/stats.min.js',
            'node_modules/three/examples/js/Detector.js',
            'node_modules/three/examples/js/controls/OrbitControls.js',
            'node_modules/tween.js/src/Tween.js',
            'node_modules/poly2tri/dist/poly2tri.js',
            'node_modules/papaparse/papaparse.js'
        ],
        appThirdPartyES6: []
    }
};

let destinations = {
    js: {
        dist: 'dist',
        example: 'example/javascript'
    }
};

let isProduction = argv.testing === true ? false : true;

let workers={};

gulp.task('workers', function() {
    return gulp.src(sources.app.tsWorker)
        .pipe(flatmap(function(stream, file) {
            let name = file.relative.toString().replace('.ts', '');
            let top=name+'.js';
            workers[name]={};
            stream= stream
               .pipe(addsrc.prepend(sources.app.common))
                .pipe(ts({
                  declaration: false,
                  noResolve: true,
                  target: 'ES6',
                  noResolve: true,
                  removeComments: true,
                  outFile: top
                })).js.pipe(concat(top))
                .pipe(insert.transform(function(contents) {
                    workers[name]['debug']=JSON.stringify(contents);
                    return contents;
                }));

            if (isProduction === true) {
              stream = stream.pipe(babel({
                  presets: ['babili'],
                  compact: true,
                  minified: true,
                  comments: false
                }))
                .pipe(insert.transform(function(contents) {
                    workers[name]['min']=JSON.stringify(contents);
                    return contents;
                }));
              }
              return stream;
        }));
});

gulp.task('build',['workers'], function() {
    let tsStream = gulp.src(sources.app.ts)
    .pipe(ts({
      declaration: true,
      noResolve: true,
      target: 'ES6',
      outFile: 'shriveling.js',
      removeComments: true
    }));
    let debugStream=
    tsStream.js
    .pipe(addsrc.prepend(sources.app.appThirdPartyES6))
    .pipe(addsrc.prepend(sources.app.appThirdParty))
    .pipe(concat('shriveling.js'));
    let minStream;
    if (isProduction === true) {
      minStream= debugStream.pipe(clone());
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

    debugStream
    .pipe(gulp.dest(destinations.js.dist))
    .pipe(gulp.dest(destinations.js.example));
    if (isProduction === true) {
      minStream
      .pipe(babel({
        presets: ['babili'],
        compact: true,
        minified: true,
        comments: false
      }))
      .pipe(rename('shriveling.min.js'))
      .pipe(gulp.dest(destinations.js.dist))
      .pipe(gulp.dest(destinations.js.example));
    }

    return tsStream.dts
    .pipe(gulp.dest(destinations.js.dist))
    .pipe(rename('shriveling.d.ts'))
    .pipe(gulp.dest(destinations.js.dist));
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
    connect.server({
      root: 'example',
      port: 8080,
      livereload: true,
      https: false});
});

gulp.task('default', ['clean', 'tslint', 'build']);
