/*jslint node: true */ // allow 'require' global
'use strict';

var gulp = require('gulp'),
    concat = require('gulp-concat'),
    del = require('del'),
    ts = require('gulp-typescript'),
    uglify = require("gulp-uglify"),
    rename = require('gulp-rename'),
    babel = require('gulp-babel'),
    shell = require('gulp-shell'),
    addsrc = require('gulp-add-src'),
    connect = require('gulp-connect');

var sources = {
    app: {
        ts: ['typings/globals/**/*.d.ts', 'node_modules/@types', './src/**/**/*.ts'],
        appThirdParty: ['node_modules/three/build/three.js', 'node_modules/three/examples/js/libs/stats.min.js', 'node_modules/three/examples/js/Detector.js',
            'node_modules/three/examples/js/controls/OrbitControls.js', 'node_modules/tween.js/src/Tween.js','node_modules/earcut/dist/earcut.min.js',
            'node_modules/poly2tri/dist/poly2tri.js'
        ]
    }
};

var destinations = {
    js: {
        dist: 'dist',
        example: 'example/javascript'
    }
};

gulp.task('build', function() {
    let tsStream = gulp.src(sources.app.ts)
        .pipe(ts({
            declaration: true,
            noResolve: true,
            target: 'ES6',
            outFile: 'shriveling.js',
            removeComments: true,
        }));
    tsStream.js
        .pipe(babel({
            presets: ['es2015']
        }))
        .pipe(addsrc.prepend(sources.app.appThirdParty))
        .pipe(concat('shriveling.js'))
        .pipe(gulp.dest(destinations.js.dist))
        .pipe(gulp.dest(destinations.js.example))
        .pipe(uglify())
        .pipe(rename('shriveling.min.js'))
        .pipe(gulp.dest(destinations.js.dist))
        .pipe(gulp.dest(destinations.js.example));

    return tsStream.dts.pipe(gulp.dest(destinations.js.dist))
        .pipe(rename('shriveling.d.ts'))
        .pipe(gulp.dest(destinations.js.dist));
});

gulp.task('tslint', shell.task('tslint -c tslint.json -e src/definition/**/*.ts src/**/**/*.ts src/*.ts'));

gulp.task('clean', function() {
    return del.sync(['dist', 'example/javascript/', 'src/**/*.js']);
});

gulp.task('server', function() {
    connect.server({
        root: 'example',
        port: 8080,
        livereload: true,
        https: false
    });
});

gulp.task('default', ['clean', 'tslint', 'build']);
