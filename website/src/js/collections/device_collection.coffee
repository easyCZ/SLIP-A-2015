define [
  'backbone',
  'backbone.radio',

  'models/device',
], (
  Backbone,
  Radio,

  Device,
) ->
  class DeviceCollection extends Backbone.Collection
    model: Device

    url: ->
      Radio.channel('application').request('apiUrl') + '/devices.json'
