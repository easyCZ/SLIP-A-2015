# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('devices', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='device',
            name='live_url',
            field=models.URLField(null=True),
        ),
    ]
