define [
  'marionette',

  'templates/dashboard/device',

  'highcharts',
  'helpers/liveChart',
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

    initialize: =>
      @model.firebase().child('raw_ecg').limitToLast(300).on 'child_added', (snapshot) =>
        @dataSeries.ecg.append snapshot.key(), snapshot.val()

      @model.firebase().child('temp').limitToLast(1).on 'child_added', (snapshot) =>
        @.$('[data-temp-live-text]').text(snapshot.val())

      @model.firebase().child('live_bpm').on 'value', (snapshot) =>
        @.$('[data-heart-rate-live-text]').text(snapshot.val())

      @model.getHistoricHeartRate()
        .then (data) =>
          @.$('.bpm-historic').highcharts
            chart:
              backgroundColor: '#000'
              height: 200
              zoomType: 'x'
            title: false
            xAxis:
              type: 'datetime'
            yAxis:
              title:
                text: 'BPM'
            legend:
              enabled: false

            series: [
              name: 'Heart Rate',
              data: data
            ]

    onAttach: =>
      pad2 = (number) ->
        if number < 10 then '0' + number else number

      @liveCharts.ecg = @.$('.ecg-live').liveChart @dataSeries.ecg,
        delay: 1750
        interpolation: 'linear'
        timestampFormatter: (date) ->
          return pad2(date.getSeconds())

    onDestroy: =>
      _(@liveCharts).each (chart) ->
        chart.stop()
