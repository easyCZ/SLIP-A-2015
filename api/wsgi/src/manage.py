#!/usr/bin/env python
import os
import sys

if __name__ == "__main__":
    # Use local config if not on openshift server
    if os.environ.get('SLIP_ENV') == 'local':
        os.environ.setdefault("DJANGO_SETTINGS_MODULE", "project.local")
    else:
        os.environ.setdefault("DJANGO_SETTINGS_MODULE", "project.settings")


    from django.core.management import execute_from_command_line

    execute_from_command_line(sys.argv)
