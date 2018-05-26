import fs from 'fs';
// import path from 'path';
import gulp from 'gulp';

// Temporary solution until gulp 4
// https://github.com/gulpjs/gulp/issues/355
import runSequence from 'run-sequence';

import ssri from 'ssri';
import modernizr from 'modernizr';

//--- styles ---
const autoprefixer = require('gulp-autoprefixer');
const cleanCSS = require('gulp-clean-css');
//const postCSS = require('gulp-postcss');
const sass = require('gulp-sass');

//-- js --
//const concat = require('gulp-concat');
//const uglify = require('gulp-uglify');
const jscs = require('gulp-jscs');
const eslint = require('gulp-eslint');

//-- общее --
const sourcemaps = require('gulp-sourcemaps');
const browserSync = require('browser-sync').create();

//-- утилиты --
const rename = require('gulp-rename');
const del = require('del');
const replace = require('gulp-replace');
//const imagemin = require('gulp-imagemin');
//const cache = require('gulp-cache');
const notify = require('gulp-notify');
const plumber = require('gulp-plumber');
const gulpif = require('gulp-if');

//--- Переменные
import pkg from './package.json';
import modernizrConfig from './modernizr-config.json';
const dirs = pkg['h5bp-configs'].directories;

// ---------------------------------------------------------------------
// | Helper tasks                                                      |
// ---------------------------------------------------------------------
gulp.task('clean', (done) => {
  del([
    // dirs.archive,
    dirs.dest
  ]).then(() => {
    done();
  });
});

gulp.task('copy', [
  'copy:.htaccess',
  'copy:html',
  'copy:jquery',
  // 'copy:license',
  'copy:misc',
  // 'copy:normalize'
]);

gulp.task('copy:.htaccess', () =>
  gulp.src('node_modules/apache-server-configs/dist/.htaccess')
    .pipe(replace(/# ErrorDocument/g, 'ErrorDocument'))
    .pipe(gulp.dest(dirs.dest))
);

gulp.task('copy:html', () => {
  const hash = ssri.fromData(
    fs.readFileSync('node_modules/jquery/dist/jquery.min.js'),
    {algorithms: ['sha256']}
  );
  let version = pkg.devDependencies.jquery;
  let modernizrVersion = pkg.devDependencies.modernizr;

  gulp.src(`${dirs.src}/*.html`)
    .pipe(replace(/{{JQUERY_VERSION}}/g, version))
    .pipe(replace(/{{MODERNIZR_VERSION}}/g, modernizrVersion))
    .pipe(replace(/{{JQUERY_SRI_HASH}}/g, hash.toString()))
    .pipe(gulp.dest(dirs.dest));
});

gulp.task('copy:jquery', () =>
  gulp.src(['node_modules/jquery/dist/jquery.min.js'])
    .pipe(rename(`jquery-${pkg.devDependencies.jquery}.min.js`))
    .pipe(gulp.dest(dirs.dest + dirs.js.lib))
);

gulp.task('copy:license', () =>
  gulp.src('LICENSE.txt')
    .pipe(gulp.dest(dirs.dest))
);

gulp.task('copy:misc', () =>
  gulp.src([

    // Copy all files
    `${dirs.src}/**/*`,

    // Exclude the following files
    // (other tasks will handle the copying of these files)
    `!${dirs.src}/css/**/*`,
    `!${dirs.src}/*.html`

  ], {

    // Include hidden files by default
    dot: true

  }).pipe(gulp.dest(dirs.dest))
);

gulp.task('copy:normalize', () =>
  gulp.src('node_modules/normalize.css/normalize.css')
    .pipe(gulp.dest(`${dirs.dest}/css`))
);

gulp.task('modernizr', (done) =>{

  modernizr.build(modernizrConfig, (code) => {
    fs.writeFile(`${dirs.dest}/js/vendor/modernizr-${pkg.devDependencies.modernizr}.min.js`, code, done);
  });

});

gulp.task('lint:js', () =>
  gulp.src([
    'gulpfile.js',
    `${dirs.src}/js/*.js`,
    `${dirs.test}/*.js`
  ]).pipe(jscs())
    .pipe(eslint())
    .pipe(eslint.failOnError())
);


// ---------------------------------------------------------------------
// | Main tasks                                                        |
// ---------------------------------------------------------------------

gulp.task('build', (done) => {
  runSequence(
    ['clean', 'lint:js'],
    'sass','copy', 'modernizr',
    done);
});

gulp.task('sass', function () {

    let isErrorSass = false;
    let onError = function (err) {
        isErrorSass = true;
        notify.onError({
            title: "Gulp",
            subtitle: "Failure!",
            message: "Error: <%= error.message %>",
            sound: "Beep"
        })(err);

        this.emit('end');
    };

    return gulp.src(dirs.src + dirs.precss.src_files)
        .pipe(plumber({errorHandler: onError}))
        .pipe(sourcemaps.init())
        .pipe(sass({outputStyle: 'expanded'}))
        .pipe(rename({suffix: '.min', prefix: ''}))
        .pipe(autoprefixer(['last 15 versions']))
        // .pipe(cleanCSS({
        //     level: 2
        // })) // Опционально, закомментировать при отладке
        .pipe(sourcemaps.mapSources(function (sourcePath, file) {
            return '../../' + dirs.src + dirs.precss.src + sourcePath;
        }))
        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest(dirs.dest + dirs.precss.dest))
        .pipe(gulpif(isErrorSass, notify({ // Add gulpif here
            title: 'Gulp',
            subtitle: 'success',
            message: 'Sass task',
            sound: "Pop"
        })))
        .pipe(browserSync.stream())
});

gulp.task('browserSync', function () {
    browserSync.init({
        server: {
            baseDir: dirs.dest
        },
        notify: true
        // tunnel: true,
        // tunnel: "projectmane", //Demonstration page: http://projectmane.localtunnel.me
    });
});

gulp.task('watch', ['copy:html', 'sass', 'browserSync'], function () {
    gulp.watch(dirs.src + dirs.precss.watch_files, ['sass']);
    // gulp.watch([conf.src + conf.js.lib + '**/*.js', conf.src + conf.js.src + 'common.js'], ['js']);
    gulp.watch(dirs.src + dirs.html.watch_files, ['copy:html', browserSync.reload]);
});

gulp.task('default', ['build']);
