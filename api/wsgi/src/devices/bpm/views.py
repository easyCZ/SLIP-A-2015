from devices.bpm.models import Bpm
from devices.bpm.serializers import BpmSerializer
from rest_framework import generics
from rest_framework import permissions


class BpmHistoryView(generics.ListCreateAPIView):
    serializer_class = BpmSerializer
    permission_classes = (permissions.AllowAny, )

    def get_queryset(self):
        return Bpm.objects.filter(device__id=self.kwargs.get('device_id'))