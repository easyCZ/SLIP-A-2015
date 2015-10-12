define [
  'backbone',
  'backbone.radio',

  'views/index',
  'views/about',
  'views/login',
], (
  Backbone,
  Radio,

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

      @listenTo Radio.channel('navigation'), 'navigate', (url, options) =>
        @navigate url, options

    index: ->
      @app.rootView.main.show new IndexView()

    about: ->
      @app.rootView.main.show new AboutView()

    login: ->
      @app.rootView.main.show new LoginView()
