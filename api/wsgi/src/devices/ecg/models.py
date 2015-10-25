import datetime
from devices.ecg.services import EcgFirebaseService


class BPM(object):

    def __init__(self, device_id, **kwargs):
        self.datetime_to = kwargs.get('datetime_to', datetime.datetime.now())
        self.datetime_from = kwargs.get('datetime_from', self.datetime_to - datetime.timedelta(minutes=5))

        self.service = EcgFirebaseService(device_id)

    def process(self):
        data = self.service.retrieve(self.datetime_from, self.datetime_to)





