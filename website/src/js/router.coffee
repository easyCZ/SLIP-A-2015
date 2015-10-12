define [
  'backbone',
  'backbone.radio',

  'views/index',
  'views/dashboard',
  'views/about',
  'views/login',
], (
  Backbone,
  Radio,

  IndexView,
  DashboardView,
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
      if Radio.channel('authentication').request('currentUser')
        @app.rootView.main.show new DashboardView()
      else
        @app.rootView.main.show new IndexView()

    about: ->
      @app.rootView.main.show new AboutView()

    login: ->
      @app.rootView.main.show new LoginView()
