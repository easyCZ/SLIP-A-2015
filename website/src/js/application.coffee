define [
  'marionette',

  'router',
  'models/user_session',
  'views/main',
], (
  Marionette,

  Router,
  UserSession,
  MainView,
) ->
  class Application extends Marionette.Application
    initialize: ->
      @session = new UserSession()

      @rootView = new MainView(el: 'body')

      @router = new Router(app: this)
      Backbone.history.start()
