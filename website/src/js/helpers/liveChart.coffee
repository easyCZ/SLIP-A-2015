define [
  'jquery',
  'smoothie',
], (
  $,
  Smoothie,
) ->
  $.fn.liveChart = (series) ->
    canvas = this

    unless canvas.attr('width')
      # SmoothieChart requires the width attribute (not style) is set correctly.
      leftMargin  = parseInt(canvas.css('margin-left').replace('px', ''))
      rightMargin = parseInt(canvas.css('margin-right').replace('px', ''))

      canvas.attr('width', canvas.parent().innerWidth() - leftMargin - rightMargin)

    chart = new SmoothieChart
      labels:
        disabled: true

    chart.addTimeSeries series,
      strokeStyle: 'rgba(0, 255, 0, 1)'
      lineWidth: 2

    chart.streamTo canvas[0], 500

    return chart
