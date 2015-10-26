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

    dataSeries:
      ecg: new TimeSeries()
      respiratory: new TimeSeries()

    liveCharts:
      ecg: null
      respiratory: null

    initialize: =>
      @model.firebase().child('raw_ecg').on 'child_added', (snapshot) =>
        @dataSeries.ecg.append snapshot.key(), snapshot.val()

    onAttach: =>
      pad2 = (number) ->
        if number < 10 then '0' + number else number

      @liveCharts.ecg = @.$('.ecg-live').liveChart @dataSeries.ecg,
        interpolation: 'linear'
        timestampFormatter: (date) ->
          return pad2(date.getSeconds())

      @liveCharts.respiratory = @.$('.respiratory-live').liveChart(@dataSeries.respiratory)

    onDestroy: =>
      _(@liveCharts).each (chart) ->
        chart.stop()
