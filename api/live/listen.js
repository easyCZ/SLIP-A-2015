var Firebase = require("firebase");

var UberVest = new Firebase('https://ubervest.firebaseio.com/');

var START_DATE = Date.now();


UberVest.child('devices').once('value', function (snapshot) {

  snapshot = snapshot.val();
  var devices = Object.keys(snapshot);

  devices.forEach(function (device_id) {

    UberVest
      .child('devices/' + device_id + '/raw_ecg')
      .on('child_added', function (data) {

      var key = data.key();
      var value = data.val();

      console.log(device_id + '\t' + key + '\t' + value);
    });

  });

});
