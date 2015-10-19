define [
  'marionette',

  'collections/device_collection',
  'views/dashboard/device',
  'templates/dashboard',
], (
  Marionette,

  DeviceCollection,
  DashboardDeviceView,
  template,
) ->
  class DashboardView extends Marionette.CompositeView
    template: template

    collection: new DeviceCollection()

    childView: DashboardDeviceView
    childViewContainer: '.devices'

    initialize: ->
      @collection.fetch()
