define [
  'backbone',
  'backbone.radio',
  'firebase',
], (
  Backbone,
  Radio,
  Firebase,
) ->
  class Device extends Backbone.Model
    url: ->
      "#{@baseUrl()}.json"

    baseUrl: ->
      if @id?
        Radio.channel('application').request('apiUrl') + "/devices/#{@id}"
      else
        Radio.channel('application').request('apiUrl') + '/devices'

    firebase: ->
      new Firebase(@get('live_url'))

    getHistoricHeartRate: ->
      @sync 'bpm', @,
        type: 'GET'
        url:  @baseUrl() + '/bpm/?format=json'
