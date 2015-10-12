define [
  'backbone',
  'backbone.radio',
], (
  Backbone,
  Radio,
) ->
  class UserSession extends Backbone.Model
    currentUser: null

    initialize: ->
      @bindListeners()
      @bindResponders()

    bindListeners: ->
      @listenTo Radio.channel('authentication'), 'login', (user) =>
        @setCurrentUser(user)

      @listenTo Radio.channel('authentication'), 'logout', =>
        @setCurrentUser(null)

    bindResponders: ->
      Radio.channel('authentication').reply 'currentUser', =>
        @getCurrentUser()

    setCurrentUser: (user) =>
      @currentUser = user

      localStorage.setItem('authToken', user.authToken)
      localStorage.setItem('firstname', user.firstname)
      localStorage.setItem('lastname', user.lastname)

    getCurrentUser: =>
      return @currentUser if @currentUser?

      authToken = localStorage.getItem('authToken')

      return unless authToken

      @currentUser =
        authToken: authToken
        firstname: localStorage.getItem('firstname')
        lastname:  localStorage.getItem('lastname')
