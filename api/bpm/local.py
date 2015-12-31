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

def choose_data(name):
    actuals = {'hayden1':68, 'hayden2':84, 'test1':'unknown', 'test2':'unknown','test3':84,'roy1':74,'filip1':60,'filip2':66}
    data = get_json(name + '_ecg.JSON')
    actual = actuals[name]
    return data, actual

def emulator(data, actual, setting, return_average = True, export = False, filename = "no export", c = False):

    window = {}
    count = 1
    if return_average:
        count1 = 0
        sum = 0
    if export and c == False:
        c = csv.writer(open(filename, 'wb'))
    for time,voltage in sorted(data.iteritems()):

        time = int(time)
    
        window[time] = voltage
        if len(window) > setting.window_length:
            min_time = min(window)
            del window[min_time]

        service_object = BPMServices(window,setting)
        BPM = service_object.get_bpm()
        
        #IMPOSE RESTRICTIONS HERE

        # PRINT AND EXPORT
        if return_average and actual <> 'unknown':
            sum += abs(BPM - actual)
            count1 += 1
        print BPM, service_object.bad_data_factor, service_object.at_risk, service_object.bad_data,count,actual
        if export:
            c.writerow(['',BPM, service_object.bad_data_factor, service_object.at_risk, service_object.bad_data, count, actual,service_object.length,service_object.size,service_object.density,service_object.beats,service_object.min_volt,service_object.max_volt,service_object.avg_volt,service_object.var_volt,service_object.step1_usage,service_object.step15_usage,service_object.step2_usage,service_object.step3_usage])
        count += 1

def EXPERIMENT1(subjects,setting, filename = 'EXPERIMENT1_undefined.CSV'):
    subjects = ['hayden1','hayden2','test1','test2','test3','roy1','filip1','filip2']
    c = csv.writer(open(filename, 'wb'))
    c.writerow([filename])
    c.writerow(['name','BPM','bad_data_factor','at_risk','bad_data_bool','row','actual BPM','duration','window size','density','beats','min_volt','max_volt','avg_volt','var_volt','step1_usage','step15_usage','step2_usage','step3_usage'])
    for subject in subjects:
        c.writerow([subject])
        data,actual = choose_data(subject)
        emulator(data,actual,setting,False,True,'USING_Predifined_CSV_FILE',c)


def print_data(data, export = False):
    if export:
        c = csv.writer(open('FILIP.csv', 'wb'))
    for time,voltage in sorted(data.iteritems()):
        print time, voltage
        if export:
            c.writerow([time,voltage])

def initialize_setting():
    setting = Setting(1)
    setting.step1_usage = [1,0,0,0,0,0,2] # NOTE keep step 10 setting as 1!!!!!
    setting.step1_benchmarks = [[0,0],[1,2],[1,5],[1,10],[1,2],[0.025,0],[0.25,0]]
    setting.min_spacing = 0.33
    setting.iter_window_len = 0.1
    setting.step15_usage = 1
    setting.step2_usage = 5
    setting.step3_usage = 2
    setting.crazy_var = 60
    setting.window_length = 200
    return setting

def main():
    sets = ['hayden1','hayden2','test1','test2','test3','roy1','filip1','filip2']
    data, actual = choose_data('filip2') 
    setting = initialize_setting()
    emulator(data,actual, setting)
    # EXPERIMENT1(sets,setting,'EXPERIMENT1_2.CSV') # ALL SETS
    # print_data(data)

main()