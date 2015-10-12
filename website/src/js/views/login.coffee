define [
  'marionette',

  'templates/login',
],(
  Marionette,

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

      return false
