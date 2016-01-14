concat = require 'gulp-concat'
foreach = require 'gulp-foreach'
gulp = require 'gulp'
gutil = require 'gulp-util'
merge = require 'merge-stream'
streamqueue = require 'streamqueue'

#
# Stylesheets
#
sass = require 'gulp-sass'

gulp.task 'sass', ->
  gulp.src 'src/css/**/*.scss'
  .pipe sass
    includePaths: [
      'bower_components'
    ]
  .pipe gulp.dest 'dist/css'
  .on 'error', gutil.log

gulp.task 'styles', ['sass']

#
# JavaScript
#
coffee = require 'gulp-coffee'
mainBowerFiles = require 'main-bower-files'
requirejs = require 'requirejs'

handlebars = require 'gulp-handlebars'
defineModule = require 'gulp-define-module'

gulp.task 'coffee', ->
  gulp.src 'src/js/**/*.coffee'
    .pipe coffee bare: true
    .pipe gulp.dest '.tmp/js'

gulp.task 'bowerScripts', ->
  mainBower = gulp.src mainBowerFiles('**/*.js')

  # Unfortunately, not everything defines a main file properly
  otherBower = gulp.src('bower_components/smoothie/smoothie.js')

  merge(mainBower, otherBower)
    .pipe gulp.dest '.tmp/js'

gulp.task 'handlebars', ->
  gulp.src 'src/templates/**/*.hbs'
    .pipe handlebars()
    .pipe(defineModule('amd'))
    .pipe gulp.dest('.tmp/js/templates')

gulp.task 'rjsBuild', ['coffee', 'bowerScripts', 'handlebars'], (callback) ->
  requirejs.optimize
    baseUrl: '.tmp/js',
    mainConfigFile: '.tmp/js/main.js',
    name: 'main',
    out: '.tmp/js/rjsBuild.js',
    wrap: true,
    optimize: 'none',
  , (response) ->
    callback()
  , (error) ->
    if error
      return callback(new gutil.PluginError('RequireJS', error))

    callback()

  return

gulp.task 'scripts', ['rjsBuild'], ->
  gulp.src ['.tmp/js/require.js', '.tmp/js/rjsBuild.js']
    .pipe concat ('app.js')
    .pipe gulp.dest('dist/js')

#
# HTML
#

gulp.task 'html', ->
  gulp.src 'src/index.html'
    .pipe gulp.dest 'dist'

#
# Report
#
kramdown = require('gulp-kramdown')

gulp.task 'report-markdown', ['sass'], ->
  gulp.src '../report/*.md'
    .pipe kramdown()
    .pipe(foreach (stream, file) ->
      header = gulp.src 'src/report/header.html'
      footer = gulp.src 'src/report/footer.html'

      streamqueue({ objectMode: true }, header, stream, footer)
        .pipe concat(file)
    )
    .pipe gulp.dest 'dist/report'

gulp.task 'report-images', ->
  gulp.src '../report/**/*.{png,jpg,svg}'
    .pipe gulp.dest 'dist/report'

gulp.task 'report-scripts', ['coffee'], ->
  gulp.src ['.tmp/js/report.js']
    .pipe gulp.dest('dist/js')


gulp.task 'report', ['report-markdown', 'report-images', 'report-scripts']

#
# Sample Data
#

gulp.task 'sample_data', ->
  gulp.src 'src/sample_data/*'
    .pipe gulp.dest 'dist/sample_data'

#
# Fonts
#

gulp.task 'fonts', ->
  gulp.src 'bower_components/fontawesome/fonts/*'
    .pipe gulp.dest 'dist/fonts'

#
# Development Server
#
connect = require('gulp-connect')

gulp.task 'connect', ->
  connect.server
    root: ['dist'],
    port: 9000,

gulp.task 'watch', ->
  gulp.watch('src/js/**/*', ['scripts'])
  gulp.watch('src/templates/**/*', ['scripts'])
  gulp.watch('src/css/**/*', ['styles'])

gulp.task 'server', ['default', 'connect', 'watch']

#
# Full Build
#

gulp.task 'default', ['styles', 'scripts', 'html', 'sample_data', 'fonts', 'report']
