define [
  'marionette',

  'templates/dashboard',
], (
  Marionette,

  template,
) ->
  class DashboardView extends Marionette.ItemView
    template: template
