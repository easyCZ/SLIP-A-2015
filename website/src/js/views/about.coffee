define [
  'marionette',
  'templates/about'
],(
  Marionette,
  template,
) ->
  class AboutView extends Marionette.ItemView
    template: template
