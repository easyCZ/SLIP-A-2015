define [
  'marionette',
  'smoothie',

  'templates/index',

  'helpers/liveChart',
],(
  Marionette,
  Smoothie,

  template,

  liveChart,
) ->
  class IndexView extends Marionette.ItemView
    template: template

    initialize: ->
      setInterval =>
        @generateDemoSeries()
      , 500

    demoSeries:
      ecg: new TimeSeries()
      heartRate: new TimeSeries()
      resipiratory: new TimeSeries()

    onAttach: ->
      @.$('.ecg-live').liveChart(@demoSeries.ecg)
      @.$('.heart-rate-live').liveChart(@demoSeries.heartRate)
      @.$('.respiratory-live').liveChart(@demoSeries.resipiratory)

    generateDemoSeries: ->
      @demoSeries.ecg.append (new Date).getTime(), Math.random() * 10000
      @demoSeries.heartRate.append (new Date).getTime(), Math.random() * 10000
      @demoSeries.resipiratory.append (new Date).getTime(), Math.random() * 10000
