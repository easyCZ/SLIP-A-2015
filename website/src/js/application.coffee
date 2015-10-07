define [
  'marionette',
  'router',
  'views/main',
], (
  Marionette,
  Router,
  MainView,
) ->
  class Application extends Marionette.Application
    initialize: ->
      @rootView = new MainView(el: 'body')

      @router = new Router(app: this)
      Backbone.history.start()
