define [
  'marionette',
  'views/navbar',
], (
  Marionette,
  Navbar,
) ->
  class MainView extends Marionette.LayoutView
    regions:
      main: "#backbone-content"
      navbar: "nav.navbar"

    initialize: ->
      @navbar.show new Navbar()
