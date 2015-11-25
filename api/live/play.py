from datetime import datetime
import math
import requests
import json

API_URL = 'http://api-ubervest.rhcloud.com'
API_DEVICE_BPM_URL = '%s/devices/%s/bpm' % (API_URL, '%s')


now = int(math.floor(datetime.now().timestamp() * 1000))
print(now)

for i in range(1000):
    timestamp = 101 + i
    bpm = 60 + (i % 30)
    device_id = 12

    r = requests.post(API_DEVICE_BPM_URL % (device_id), data={
        'timestamp': timestamp,
        'bpm': bpm,
        'device': device_id
    })
    print(r)