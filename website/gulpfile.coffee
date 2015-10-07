gulp = require 'gulp'
concat = require 'gulp-concat'
gutil = require 'gulp-util'

#
# Stylesheets
#
sass = require 'gulp-sass'

gulp.task 'sass', ->
  gulp.src 'src/scss'
  .pipe sass()
  .pipe gulp.dest '.tmp/css'
  .on 'error', gutil.log

gulp.task 'styles', ['sass']

#
# JavaScript
#
coffee = require 'gulp-coffee'
mainBowerFiles = require 'main-bower-files'
rjs = require 'gulp-requirejs'

handlebars = require 'gulp-handlebars'
defineModule = require 'gulp-define-module'

gulp.task 'coffee', ->
  gulp.src 'src/js/**/*.coffee'
    .pipe coffee bare: true
    .pipe gulp.dest '.tmp/js'

gulp.task 'bowerScripts', ->
  gulp.src mainBowerFiles '**/*.js'
    .pipe gulp.dest '.tmp/js'

gulp.task 'handlebars', ->
  gulp.src 'src/templates/**/*.hbs'
    .pipe handlebars()
    .pipe(defineModule('amd'))
    .pipe concat 'templates.js'
    .pipe gulp.dest('.tmp/js/templates')

gulp.task 'scripts', ['coffee', 'bowerScripts', 'handlebars'], ->
  rjs
    baseUrl: '.tmp/js',
    mainConfigFile: '.tmp/js/main.js',
    name: 'main',
    out: 'app.js'
    wrap: true,
  .pipe gulp.dest('dest/js')

#
# Full Build
#

gulp.task 'default', ['styles', 'scripts']
