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
      @liveCharts.ecg = @.$('.ecg-live').liveChart(@dataSeries.ecg)
      @liveCharts.respiratory = @.$('.respiratory-live').liveChart(@dataSeries.respiratory)

    onDestroy: =>
      _(@liveCharts).each (chart) ->
        chart.stop()
