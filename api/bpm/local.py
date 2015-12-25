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

def emulator(data, actual, return_average = True, export = False, filename = "no export"):
    window_length = 600
    window = {}
    count = 0
    if return_average:
        count1 = 0
        sum = 0
    if export:
        c = csv.writer(open(filename, 'wb'))
    for time,voltage in sorted(data.iteritems()):
    
        window[time] = voltage
        if len(window) > window_length:
            min_time = min(window, key = window.get)
            del window[min_time]

        service_object = BPMServices(window)
        BPM = service_object.get_bpm()
        
        #IMPOSE RESTRICTIONS HERE
        if count > window_length:
            if export:
                c.writerow([BPM, abs(actual-BPM)])
            if return_average:
                sum += abs(BPM - actual)
                count1 += 1
            if actual <> 'unknown':
                print BPM, actual - BPM
            else:
                print BPM

        count += 1

    # return sum/float(count1)

def print_beats(data, export = False):
    subject = BPMServices(data)

    # CHOOSE METHOD
    # beats = subject.get_peaks()
    beats = subject.get_beats()
    if export:
        c = csv.writer(open('subject_beats.csv', 'wb'))

    for beat in beats:
        print beat, len(beats)
        if export:
            c.writerow(beat)

def choose_data(name):
    actuals = {'hayden1':68, 'hayden2':84, 'test1':'unknown', 'test2':'unknown','roy1':74,'filip1':60,'filip2':66}
    data = get_json(name + '_ecg.JSON')
    actual = actuals[name]
    return data, actual

def print_data(data, export = False):
    if export:
        c = csv.writer(open('FILIP.csv', 'wb'))
    for time,voltage in sorted(data.iteritems()):
        print time, voltage
        if export:
            c.writerow([time,voltage])

def test():
    c = csv.writer(open('experiment.csv', 'wb'))
    for i in range(1,21):
        window_length = i*100
        for person in [['Roy',74],['Hayden',68],['Filip',60]]:
            data = get_json(person[0] + '_raw_ecg.JSON')
            diff = emulator(data,person[1],window_length)
            c.writerow([window_length,person[0],diff])

def main():
    data, actual = choose_data('filip1')
    emulator(data,actual)
    # print_beats(data)
    # print_data(data)
    # test() 

main()