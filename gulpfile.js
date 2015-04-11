require('babel/register')
// see: https://github.com/babel/babel/issues/489#issuecomment-69919417
Object.getPrototypeOf.toString = Object.toString.bind(Object)
var gulp = require('gulp')
var babel = require('gulp-babel')
var mocha = require('gulp-mocha')
var matcha = require('gulp-matcha')
var sequence = require('run-sequence')

gulp.task('default', [
  'watch'
])

gulp.task('build', function () {
  return gulp.src('lib/**/*.js')
    .pipe(babel())
    .pipe(gulp.dest('dist'))
})

gulp.task('test', ['build'], function () {
  require('should')
  return gulp.src('test/**/*.js', {
    read: false
  })
  .pipe(mocha({
    reporter: 'spec',
    timeout: 5000
  }))
  .once('error', function (e) {
    console.error(e.message)
  })
})

gulp.task('bench', ['build'], function () {
  return gulp.src('benchmark/**/*.js', {
    read: false
  })
  .pipe(matcha())
})

gulp.task('watch', function () {
  gulp.watch('lib/**/*.js', [
    'build'
  ])

  gulp.watch([
    'dist/**/*.js',
    'test/**/*.js',
    'benchmark/**/*.js'
  ], [
    'watch:suite'
  ])
})

gulp.task('watch:suite', function (done) {
  // TODO: Figure out why it doesn't work when I have `test` first.
  sequence('bench', 'test', done)
})
