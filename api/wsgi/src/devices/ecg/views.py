from devices.ecg import serializers
from devices.ecg.models import BPM
from devices.models import Device
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet


class DeviceEcg(ViewSet):

    serializer_class = serializers.BPMSerializer
    permission_classes = (permissions.AllowAny, )

    def get(self, request, pk, format=None):
        bpm = BPM(pk)
        bpm.process()

        serializer = serializers.BPMSerializer(
            instance=bpm)
        return Response(serializer.data)
        # return Response('hello')

    def list(self, request):
        # serializer = serializers.TaskSerializer(
        #     instance=tasks.values(), many=True)
        # return Response(serializer.data)
        return Response('hello')
