"use strict"

require.config
  baseUrl: '/js'

  paths:
    marionette: 'backbone.marionette'

  shim:
    firebase:
      exports: 'Firebase'

require [
  'application',
  'bootstrap',
], (
  Application
) ->
  window.application = new Application()
