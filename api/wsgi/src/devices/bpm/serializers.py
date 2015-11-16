
from devices.bpm.models import Bpm
from rest_framework import serializers


class BpmSerializer(serializers.ModelSerializer):

    class Meta:
        model = Bpm
