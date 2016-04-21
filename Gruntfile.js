'use strict'

module.exports = function (grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    // Install bower dependencies
    bower_concat: {
      all: {
        dest: {
          'js': 'www/lib/bower.js',
          'css': 'www/lib/bower.css'
        },
        separator: ';\n',
        mainFiles: {
          'Base58': 'Base58.js',
          'bootstrap': 'dist/js/bootstrap.js',
          'bootswatch': 'sandstone/bootstrap.css',
          'lie': 'dist/lie.polyfill.js',
          'sjcl': [
            'sjcl.js',
            'core/sha1.js',
            'core/codecBytes.js'
          ]
        },
        process: function (src) {
          // Alter src to remove Google Fonts dependency from Bootswatch
          return src
          .replace('@import url("https://fonts.googleapis.com/css?family=Roboto:400,500");', '')
          .replace(/\.\.\/fonts\/glyphicons/g, '../lib/glyphicons')
        }
      }
    },

    // Copy Bootstrap fonts
    copy: {
      main: {
        files: [
          {
            expand: true,
            flatten: true,
            src: ['bower_components/bootstrap/dist/fonts/*'],
            dest: 'www/lib/',
            filter: 'isFile'
          },
          {
            expand: true,
            flatten: true,
            src: ['src/css/app.css', 'src/js/app.js'],
            dest: 'www/'
          }
        ]
      }
    },

    // Process HTML file includes
    includes: {
      files: {
        src: ['src/index.html'],
        dest: 'www/',
        flatten: true
      }
    },

    // Minimize JS
    uglify: {
      prod: {
        files: {
          'www/lib/bower.js': ['www/lib/bower.js']
        }
      }
    },

    // Minimize CSS
    cssmin: {
      prod: {
        files: {
          'www/lib/bower.css': ['www/lib/bower.css']
        }
      }
    }
  })

  grunt.loadNpmTasks('grunt-bower-concat')
  grunt.loadNpmTasks('grunt-contrib-copy')
  grunt.loadNpmTasks('grunt-includes')
  grunt.loadNpmTasks('grunt-contrib-uglify')
  grunt.loadNpmTasks('grunt-contrib-cssmin')

  grunt.registerTask('dev', ['bower_concat', 'copy', 'includes'])
  grunt.registerTask('prod', ['bower_concat', 'copy', 'includes', 'uglify', 'cssmin'])
  grunt.registerTask('default', ['prod'])
}
