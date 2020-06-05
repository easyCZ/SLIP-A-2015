#!/usr/bin/env python

from setuptools import setup

setup(
    # GETTING-STARTED: set your app name:
    name='UberVest API',
    # GETTING-STARTED: set your app version:
    version='1.0',
    # GETTING-STARTED: set your app description:
    description='System Level Integration Project at University of Edinburgh',
    # GETTING-STARTED: set author name (your name):
    author='SLIP A 2015',
    # GETTING-STARTED: set author email (your email):
    author_email='slip.group.a.2015@gmail.com',
    # GETTING-STARTED: set author url (your url):
    url='http://easycz.github.io/SLIP-A-2015/',
    # GETTING-STARTED: define required django version:
    install_requires=[
        'Django==1.11.29'
    ],
    dependency_links=[
        'https://pypi.python.org/simple/django/'
    ],
)
