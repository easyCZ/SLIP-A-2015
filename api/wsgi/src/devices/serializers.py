from devices.models import Device
from rest_framework import serializers


class DeviceSerializer(serializers.Serializer):

    class Meta:
        model = Device