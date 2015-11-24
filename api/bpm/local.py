# are you sure the first one gets popped from window?
# tweak extrapolation and peak values


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
    window_length = 1000
    window = {}
    count = 0
    for time,voltage in data.items():
    
        window[time] = voltage
        if len(window) > window_length:
            min_time = min(window, key = window.get)
            del window[min_time]

        service_object = BPMServices(window)
        BPM = service_object.get_bpm()
        
        #IMPOSE RESTRICTIONS HERE
        if count > window_length:
            print BPM

        count += 1

def return_beats(data):
    Hayden = BPMServices(data)

    # CHOOSE METHOD
    # beats = Hayden.get_peaks()
    beats = Hayden.get_beats()
    # c = csv.writer(open('hayden_beats.csv', 'wb'))
    # for beat in beats:
    #     c.writerow(beat)

    print beats, len(beats)

def choose_data():
    data = get_json('Hayden_raw_ecg.JSON')
    # data = get_json('raw_ecg.JSON')
    # data = get_json('test_data.JSON')
    # data = get_json('Filip_raw_ecg.JSON')
    return data

def print_data(data):
    # c = csv.writer(open('FILIP.csv', 'wb'))
    for time,voltage in sorted(data.iteritems()):
        print time, voltage
        # c.writerow([time,voltage])

def main():
    data = choose_data()
    # emulator(data)
    return_beats(data)
    # print_data(data)


main()