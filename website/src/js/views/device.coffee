define [
  'marionette',
  'jquery',
  'templates/device',
], (
  Marionette,
  $,
  template,
) ->
  class window.DeviceView extends Marionette.ItemView
    template: template
