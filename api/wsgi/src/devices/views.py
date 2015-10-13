from devices.models import Device
from devices.serializers import DeviceSerializer
from rest_framework import viewsets
from rest_framework.generics import ListCreateAPIView
from rest_framework.viewsets import ModelViewSet


class DevicesListView(ModelViewSet):
    queryset = Device.objects.all()
    serializer_class = DeviceSerializer