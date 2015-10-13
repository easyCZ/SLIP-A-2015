from devices.models import Device
from rest_framework import serializers


class DeviceSerializer(serializers.ModelSerializer):

    class Meta:
        model = Device
        # fields = ('id', 'owner', 'live_url', )