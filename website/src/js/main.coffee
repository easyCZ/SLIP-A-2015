"use strict"

require.config
  baseUrl: '/js'

  paths:
    marionette: 'backbone.marionette'

  shim:
    firebase:
      exports: 'Firebase'

require [
  'application'
], (
  Application
) ->
  window.application = new Application()
