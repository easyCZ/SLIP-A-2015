define [
  'marionette',
  'backbone.radio',

  'templates/login',
],(
  Marionette,
  Radio,

  template,
) ->
  class LoginView extends Marionette.ItemView
    template: template

    events:
      'submit form': 'login'

    login: (e) ->
      e.preventDefault()

      formData = @.$('form').serialize()

      # Fire off an event after login
      loginCallback = (user) ->
        Radio.channel('authentication').trigger 'login', user

        Radio.channel('navigation').trigger 'navigate', '/', trigger: true

      loginCallback
        authToken: '123456789'
        firstname: 'Test'
        lastname: 'Tester'

      return false
