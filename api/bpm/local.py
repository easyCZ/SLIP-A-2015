# are you sure the first one gets popped from window?

import json
import csv
from services import BPMServices

def get_json(file_name):
    with open(file_name) as f:
        json_data = json.loads(f.read())
        return json_data
    return {}


# Hayden = BPMServices(Hayden_data)
# hayden_beats = Hayden.get_peaks()
# Hayden_BPM = Hayden.get_bpm()

def emulator(data):
    window_length = 2000
    window = {}
    for time,voltage in data.items():
        window[time] = voltage
        if len(window) > window_length:
            min_time = min(window, key = window.get)
        # del window
    print window



def main():
    Hayden_data = get_json('Hayden_raw_ecg.JSON')
    emulator(Hayden_data)

main()