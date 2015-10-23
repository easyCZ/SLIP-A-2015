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
      @demoSeries.heartRate.append((new Date()).getTime(), 65)

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
      date = new Date()
      time = date.getTime()

      # ECG
      if @sampleData.ecg
        # We have 2500 samples in 10 seconds
        sampleTime = (time % 10000)
        sampleNo = Math.round(sampleTime / 4)

        sample = @sampleData.ecg[sampleNo]

        if sample
          @demoSeries.ecg.append time, sample

      # Heart Rate
      offsetRandom = Math.random() * 100
      current = @demoSeries.heartRate.data
      last = current[current.length - 1][1]

      if ((time % 20) < 5)
        if offsetRandom > 99.5 && last < 80
          newValue = last + 1
        else if offsetRandom > 99.0 && last > 60
          newValue = last - 1

      newValue ||= last
      @demoSeries.heartRate.append time, newValue

    onDestroy: =>
      clearInterval(@generateInterval)

      _(@liveCharts).each (chart) ->
        chart.stop()
