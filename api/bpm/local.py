import json
import csv
from services import BPMServices
from services import BPMmethod


class Setting(object):

    def __init__(self,ID):
        self.ID = ID

def get_json(file_name):
    with open(file_name) as f:
        json_data = json.loads(f.read())
        return json_data
    return {}

def emulator(data, actual, settings, return_average = True, export = False, filename = "no export"):

    window_length = 200
    window = {}
    count = 0
    if return_average:
        count1 = 0
        sum = 0
    if export:
        c = csv.writer(open(filename, 'wb'))
    for time,voltage in sorted(data.iteritems()):

        time = int(time)
    
        window[time] = voltage
        if len(window) > window_length:
            min_time = min(window)
            del window[min_time]

        service_object = BPMServices(window,settings)
        BPM = service_object.get_bpm()
        
        #IMPOSE RESTRICTIONS HERE

        # PRINT AND EXPORT
        if export:
                    c.writerow([BPM, abs(actual-BPM)])
        if return_average and actual <> 'unknown':
            sum += abs(BPM - actual)
            count1 += 1
        if actual <> 'unknown':
            print BPM, actual - BPM, service_object.bad_data_factor, service_object.at_risk
        else:
            print 'insufficient data'

        count += 1

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

def initialize_setting():
    setting = Setting(1)
    setting.step1_usage = [1,0,0,0,0,0,0,2] # NOTE keep step 10 setting as 1!!!!!
    setting.step1_benchmarks = [[0,0],[1,2],[1,5],[1,10],[1,2],[-0.0125,0],[0.025,0],[0.25,0]]
    setting.min_spacing = 0.33
    setting.iter_window_len = 0.1
    setting.step15_usage = 2
    setting.step2_usage = 5
    setting.step3_usage = 3
    setting.crazy_var = 60
    return setting

def main():
    sets = ['hayden1','hayden2','test1','test2','roy1','filip1','filip2']
    data, actual = choose_data('hayden2') 
    setting = initialize_setting()
    emulator(data,actual, setting)
    # print_data(data)

main()