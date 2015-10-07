define [
  'marionette',
], (
  Marionette,
) ->
  class MainView extends Marionette.LayoutView
    regions:
      main: "#backbone-content"
