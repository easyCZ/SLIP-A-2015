"use strict"

require.config
  baseUrl: '/js'

  paths:
    marionette: 'backbone.marionette'

require [
  'application'
], (
  Application
) ->
  window.application = new Application()
