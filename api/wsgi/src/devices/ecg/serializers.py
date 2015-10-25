from rest_framework import serializers


class BPMSerializer(serializers.Serializer):
    datetime_from = serializers.DateTimeField()
    datetime_to = serializers.DateTimeField()
    bpm = serializers.IntegerField(read_only=True)