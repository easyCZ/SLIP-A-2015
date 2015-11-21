import json

data = {}
with open('5sec.json') as f:
    data = json.loads(f.read())

for key, value in data.iteritems():
    print("{0},{1}".format(key, value))