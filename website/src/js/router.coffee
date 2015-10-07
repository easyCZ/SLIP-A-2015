define [
  'backbone',
  'views/index',
  'views/about',
], (
  Backbone,
  IndexView,
  AboutView,
) ->
  class Router extends Backbone.Router
    routes:
      '': 'index',
      'about': 'about',

    initialize: (options) ->
      @app = options.app

    index: ->
      @app.rootView.main.show new IndexView()

    about: ->
      @app.rootView.main.show new AboutView()
