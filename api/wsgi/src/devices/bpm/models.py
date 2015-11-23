from devices.models import Device
from django.db import models

class Bpm(models.Model):
    device = models.ForeignKey(Device)
    timestamp = models.IntegerField()
    bpm = models.IntegerField()
