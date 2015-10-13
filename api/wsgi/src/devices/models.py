from django.db import models

class Device(models.Model):
    owner = models.TextField()


