define [
  'jquery',
  'underscore',
  'marionette',
  'backbone.radio',
  'smoothie',

  'templates/index',

  'helpers/liveChart',
],(
  $,
  _,
  Marionette,
  Radio,
  Smoothie,

  template,

  liveChart,
) ->
  class IndexView extends Marionette.ItemView
    template: template

    initialize: ->
      @generateInterval = setInterval =>
        @generateDemoSeries()
      , 4

      $.getJSON Radio.channel('application').request('websiteBaseUrl') + '/sample_data/ecg.json', (response) =>
        @sampleData.ecg = response.data

    sampleData: {}

    demoSeries:
      ecg: new TimeSeries()
      heartRate: new TimeSeries()
      respiratory: new TimeSeries()

    liveCharts:
      ecg: null
      heartRate: null
      respiratory: null

    onAttach: =>
      @liveCharts.ecg = @.$('.ecg-live').liveChart(@demoSeries.ecg)
      @liveCharts.heartRate = @.$('.heart-rate-live').liveChart(@demoSeries.heartRate)
      @liveCharts.respiratory = @.$('.respiratory-live').liveChart(@demoSeries.respiratory)

    generateDemoSeries: =>
      # @demoSeries.heartRate.append (new Date).getTime(), Math.random() * 10000
      # @demoSeries.respiratory.append (new Date).getTime(), Math.random() * 10000

      if @sampleData.ecg
        date = new Date()
        # We have 2500 samples in 10 seconds
        time = date.getTime()
        sampleTime = (time % 10000)
        sampleNo = Math.round(sampleTime / 4)

        sample = @sampleData.ecg[sampleNo]

        if sample
          time = date.getTime()
          @demoSeries.ecg.append time, sample

    onDestroy: =>
      clearInterval(@generateInterval)

      _(@liveCharts).each (chart) ->
        chart.stop()
