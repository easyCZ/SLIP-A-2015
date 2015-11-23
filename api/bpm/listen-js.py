import sys
import requests
from collections import OrderedDict
from services import BPMServices
import json

FIREBASE_URL = 'https://ubervest.firebaseio.com'
DEVICES_URL = '%s/devices.json' % FIREBASE_URL
DEVICE_URL = '%s/devices/%s.json' % (FIREBASE_URL, '%s')

API_URL = 'http://api-ubervest.rhcloud.com'
API_DEVICE_BPM_URL = '%s/devices/%s/bpm' % (API_URL, '%s')

WINDOW_SIZE = 1000

window = OrderedDict()

for line in sys.stdin:
    device_id, timestamp, voltage = line.strip().split('\t')
    voltage = int(voltage)
    timestamp = int(timestamp)
    device_id = int(device_id)

    window[timestamp] = voltage

    if len(window) > WINDOW_SIZE:
        window.popitem(False)  # pop in FIFO order

    bpm = BPMServices(window).get_bpm()
    print(bpm)

    # requests.patch(DEVICE_URL % (device_id), data=json.dumps({'live_bpm': bpm}))
    # print("[Device] #%s - Updated firebase bpm to %d" % (device_id, bpm))

    # requests.put(API_DEVICE_BPM_URL % (device_id), data=json.dumps({
    #     'timestamp': timestamp,
    #     'bpm': bpm,
    #     'device': device_id
    # }))
    # print("[Device] #%s - Updated API bpm" % device_id)




