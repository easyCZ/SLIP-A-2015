define [
  'backbone',
], (
  Backbone,
) ->
  class Device extends Backbone.Model
    url: ->
      if id?
        Radio.channel('application').request('apiUrl') + "/devices/#{id}.json"
      else
        Radio.channel('application').request('apiUrl') + '/devices.json'
