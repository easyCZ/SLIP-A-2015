import requests
from sseclient import SSEClient
import threading
import json
from collections import OrderedDict
import random
import math
from services import BPMService

FIREBASE_URL = 'https://ubervest.firebaseio.com'
DEVICES_URL = '%s/devices.json' % FIREBASE_URL
DEVICE_URL = '%s/devices/%s.json' % (FIREBASE_URL, '%s')

API_URL = 'http://api-ubervest.rhcloud.com'
API_DEVICE_BPM_URL = '%s/devices/%s/bpm' % (API_URL, '%s')

WINDOW_SIZE = 25


class Device(threading.Thread):

    def __init__(self, device_id):
        self.device_id = device_id
        self.window = OrderedDict()
        super(Device, self).__init__()

    def run(self):
        client = SSEClient(DEVICE_URL % self.device_id)

        for message in client:
            data = json.loads(message.data)

            if not data:
                print("[Device] #%s - Received a healthcheck." % self.device_id)
            # All data - generally on initial connect
            elif data['path'] == '/':
                print('[Device] #%s - Received data on initial connect.' % self.device_id)
                pass
            elif data['path'].startswith('/raw_ecg/'):
                voltage = data['data']  # data is a float
                timestamp = int(data['path'].split('/')[-1])
                self.window[timestamp] = voltage

                if len(self.window) > WINDOW_SIZE:
                    self.window.popitem(False)  # pop in FIFO order

                # TODO: Call service to calcualte current bpm
                # int(math.ceil(random.random() * 80))
                bpm = BPMService(self.window).get_bpm()

                # store to firebase
                requests.patch(DEVICE_URL % (self.device_id), data=json.dumps({'live_bpm': bpm}))
                print("[Device] #%s - Updated firebase bpm to %d" % (self.device_id, bpm))

                requests.put(API_DEVICE_BPM_URL % (self.device_id), data=json.dumps({
                    'timestamp': timestamp,
                    'bpm': bpm,
                    'device': self.device
                }))
                print("[Device] #%s - Updated API bpm")


def main():
    device_ids = requests.get(DEVICES_URL, params={'shallow': True}).json().keys()

    for device_id in device_ids:
        thread = Device(device_id)
        thread.start()
        print('[Main] Started thread for device #%s' % device_id)



if __name__ == "__main__":
    main()
