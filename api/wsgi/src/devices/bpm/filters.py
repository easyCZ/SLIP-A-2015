from devices.bpm.models import Bpm
import django_filters


class ProductFilter(django_filters.FilterSet):
    timestamp_from = django_filters.NumberFilter(name="timestamp", lookup_type='gte')
    timestamp_to = django_filters.NumberFilter(name="timestamp", lookup_type='lte')

    class Meta:
        model = Bpm
        fields = ['timestamp']