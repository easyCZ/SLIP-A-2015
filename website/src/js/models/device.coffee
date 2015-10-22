define [
  'backbone',
  'firebase',
], (
  Backbone,
  Firebase,
) ->
  class Device extends Backbone.Model
    url: ->
      if id?
        Radio.channel('application').request('apiUrl') + "/devices/#{id}.json"
      else
        Radio.channel('application').request('apiUrl') + '/devices.json'

    firebase: ->
      new Firebase(@get('live_url'))
