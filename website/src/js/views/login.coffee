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

      alert("Logging in with #{formData}")

      # Fire off an event after login
      authToken = '123456789'
      firstname = 'Test'
      lastname  = 'Tester'
      Radio.channel('authentication').trigger 'login',
        authToken: authToken
        firstname: firstname
        lastname:  lastname

      return false
