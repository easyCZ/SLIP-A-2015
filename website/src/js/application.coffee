define [
  'marionette',
  'backbone.radio',

  'router',
  'models/user_session',
  'views/main',
], (
  Marionette,
  Radio,

  Router,
  UserSession,
  MainView,
) ->
  class Application extends Marionette.Application
    apiUrl: ->
      if window.location.toString().match(/localhost/)
        return 'http://localhost:8000'
      else
        return 'http://api-ubervest.rhcloud.com'

    initialize: ->
      @bindRadioResponses()

      @session = new UserSession()

      @rootView = new MainView(el: 'body')

      @router = new Router(app: this)
      Backbone.history.start()

    bindRadioResponses: =>
      Radio.channel('application').reply 'apiUrl', =>
        @apiUrl()
