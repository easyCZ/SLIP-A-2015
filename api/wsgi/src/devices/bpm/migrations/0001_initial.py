# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('devices', '0002_device_live_url'),
    ]

    operations = [
        migrations.CreateModel(
            name='Bpm',
            fields=[
                ('id', models.AutoField(verbose_name='ID', auto_created=True, primary_key=True, serialize=False)),
                ('timestamp', models.IntegerField()),
                ('bpm', models.IntegerField()),
                ('device', models.ForeignKey(to='devices.Device')),
            ],
        ),
    ]
