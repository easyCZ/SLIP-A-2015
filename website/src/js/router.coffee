define [
  'backbone',
  'views/index',
  'views/about',
  'views/login',
], (
  Backbone,
  IndexView,
  AboutView,
  LoginView,
) ->
  class Router extends Backbone.Router
    routes:
      '': 'index',
      'about': 'about',
      'login': 'login',

    initialize: (options) ->
      @app = options.app

    index: ->
      @app.rootView.main.show new IndexView()

    about: ->
      @app.rootView.main.show new AboutView()

    login: ->
      @app.rootView.main.show new LoginView()
