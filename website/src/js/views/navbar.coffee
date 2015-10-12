define [
  'marionette',
  'backbone.radio',

  'templates/navbar',
],(
  Marionette,
  Radio,

  template,
) ->
  class NavbarView extends Marionette.ItemView
    template: template

    user: null

    events:
      'click [data-logout]': 'logout'

    serializeData: ->
      data = @user || {}
      data.loggedIn = @user?

      return data

    initialize: ->
      Radio.channel('authentication').request 'currentUser', (user) =>
        @user = user

      @listenTo Radio.channel('authentication'), 'login', (user) =>
        @user = user

        @render()

      @listenTo Radio.channel('authentication'), 'logout', (user) =>
        @user = null

        @render()

    logout: ->
      Radio.channel('authentication').trigger('logout')
