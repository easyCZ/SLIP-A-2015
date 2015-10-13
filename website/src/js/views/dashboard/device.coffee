define [
  'marionette',

  'templates/dashboard/device',
], (
  Marionette,

  template,
) ->
  class DashboardDeviceView extends Marionette.ItemView
    tagName: 'li'
    className: 'device'

    template: template
