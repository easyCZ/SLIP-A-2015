"use strict"

require.config
  baseUrl: '/js'

  shim:
    templates:
      deps: ["handlebars"]
      exports: "templates"

  paths:
    marionette: 'backbone.marionette'
    templates:  'app/templates'

require [
  'application'
], (
  Application
) ->
  window.application = new Application()
