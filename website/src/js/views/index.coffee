define [
  'underscore',
  'marionette',
  'smoothie',

  'templates/index',

  'helpers/liveChart',
],(
  _,
  Marionette,
  Smoothie,

  template,

  liveChart,
) ->
  class IndexView extends Marionette.ItemView
    template: template

    initialize: ->
      @generateInterval = setInterval =>
        @generateDemoSeries()
      , 500

    demoSeries:
      ecg: new TimeSeries()
      heartRate: new TimeSeries()
      resipiratory: new TimeSeries()

    liveCharts:
      ecg: null
      heartRate: null
      resipiratory: null

    onAttach: =>
      @liveCharts.ecg = @.$('.ecg-live').liveChart(@demoSeries.ecg)
      @liveCharts.heartRate = @.$('.heart-rate-live').liveChart(@demoSeries.heartRate)
      @liveCharts.resipiratory = @.$('.respiratory-live').liveChart(@demoSeries.resipiratory)

    generateDemoSeries: =>
      @demoSeries.ecg.append (new Date).getTime(), Math.random() * 10000
      @demoSeries.heartRate.append (new Date).getTime(), Math.random() * 10000
      @demoSeries.resipiratory.append (new Date).getTime(), Math.random() * 10000

    onDestroy: =>
      clearInterval(@generateInterval)

      _(@liveCharts).each (chart) ->
        chart.stop()
