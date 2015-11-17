
from devices.bpm.models import Bpm
from devices.models import Device
from rest_framework import serializers


class BpmSerializer(serializers.ModelSerializer):
    # timestamp = serializers.IntegerField()
    # bpm = serializers.IntegerField()

    class Meta:
        model = Bpm
        fields = ('timestamp', 'bpm', 'device')
