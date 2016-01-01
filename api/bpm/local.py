import json
import csv
from services import BPMServices
from services import BPMmethod


class Setting(object):

    def __init__(self,step1_usage,step1_benchmarks,step15_usage,step2_usage,step3_usage,crazy_var,min_spacing,iter_window_len,window_length):
        self.step1_usage = step1_usage
        self.step1_benchmarks = step1_benchmarks
        self.step15_usage = step15_usage
        self.step2_usage = step2_usage
        self.step3_usage = step3_usage
        self.crazy_var = crazy_var
        self.min_spacing = min_spacing
        self.iter_window_len = iter_window_len
        self.window_length = window_length

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

def emulator(data, actual, setting,time_saver = False, export = False, filename = "no export", c = False, avg_diff = True):

    window = {}
    count = 0
    if avg_diff:
        count1 = 0
        difference = 0
    if export and c == False:
        c = csv.writer(open(filename, 'wb'))
    for time,voltage in sorted(data.iteritems()):

        count += 1
        time = int(time)
        
        window[time] = voltage
        if len(window) > setting.window_length:
            min_time = min(window)
            del window[min_time]

        if time_saver == False or count%200 == 0:
            service_object = BPMServices(window,setting)
            BPM = service_object.get_bpm()
            if avg_diff:
                if service_object.bad_data == False and service_object.at_risk == False:
                    count1 += 1
                    difference += abs(BPM - actual)
            #IMPOSE RESTRICTIONS HERE

            # PRINT AND EXPORT
            # print BPM, service_object.per100, service_object.at_risk, service_object.bad_data,actual
            if export:
                c.writerow(['',BPM, service_object.bad_data_factor, service_object.at_risk, service_object.bad_data, actual,service_object.length,service_object.size,service_object.density,service_object.beats,service_object.min_volt,service_object.max_volt,service_object.avg_volt,service_object.var_volt,service_object.step1_usage,service_object.step15_usage,service_object.step2_usage,service_object.step3_usage])
    if avg_diff and count1 <> 0:
        return float(difference)/count1
    else:
        return 100

def EXPERIMENT1(subjects,setting, filename = 'EXPERIMENT1_undefined.CSV'):
    subjects = ['hayden1','hayden2','test1','test2','test3','roy1','filip1','filip2']
    c = csv.writer(open(filename, 'wb'))
    c.writerow([filename])
    c.writerow(['name','BPM','bad_data_factor','at_risk','bad_data_bool','actual BPM','duration','window size','density','beats','min_volt','max_volt','avg_volt','var_volt','step1_usage','step15_usage','step2_usage','step3_usage'])
    for subject in subjects:
        c.writerow([subject])
        data,actual = choose_data(subject)
        emulator(data,actual,setting,False,True,'USING_Predifined_CSV_FILE',c)

def EXPERIMENT2(subjects,filename):
    c = csv.writer(open(filename,'wb'))
    c.writerow([filename])
    step1_benchmarks = [[0,0],[1.01,0],[1.025,0],[1.05,0],[0.25,0]]
    min_spacing = 0.33
    iter_window_len = 0.1
    crazy_var = 60
    window_length = 200
    step15_usage = 1
    settings = settings2(step1_benchmarks,min_spacing,iter_window_len,crazy_var,window_length,step15_usage)
    c.writerow(['min_spacing','iter_window_len', 'crazy_var', 'window_length','step1_benchmarks','step15_usage'])
    c.writerow([min_spacing,iter_window_len,crazy_var,window_length,step1_benchmarks,step15_usage])
    c.writerow(['subject','avg diff','setting.step1_usage','setting.step1_benchmarks', 'setting.step15_usage','setting.step2_usage','setting.step3_usage'])
    for setting in settings:
        avg_diff = 0
        for subject in subjects:
            data, actual = choose_data(subject)
            diff = emulator(data,actual,setting,True,False,'Using_predefined_csv_file',False,True)
            avg_diff = avg_diff + diff
        avg_diff = avg_diff/3
        c.writerow([subjects,avg_diff,setting.step1_usage,setting.step1_benchmarks, setting.step15_usage,setting.step2_usage,setting.step3_usage])

def settings2(step1_benchmarks,min_spacing,iter_window_len,crazy_var,window_length,step15_usage):
    settings = []
    count = 0
    step1_usages = generate_step1_usage()
    for step1_usage in step1_usages:
        for step2_usage in range(1,7):
            for step3_usage in [1,2]:
                settings.append(1)
                settings[count] = Setting(step1_usage,step1_benchmarks,step15_usage,step2_usage,step3_usage,crazy_var,min_spacing,iter_window_len,window_length)
                count += 1
    return settings

def generate_step1_usage():
    usages = []
    for method1 in range(0,5):
        for method2 in range(0,5):
            for method3 in range(0,5):
                for method4 in range(0,5):
                    if method1 <> 0 or method2 <>0 or method3 <>0 or method4<>0:
                        usages.append([1,method1,method2,method3,method4])
    return usages

def print_data(data, export = False):
    if export:
        c = csv.writer(open('FILIP.csv', 'wb'))
    for time,voltage in sorted(data.iteritems()):
        print time, voltage
        if export:
            c.writerow([time,voltage])

def initialize_setting():
    step1_usage = [1,0,0,0,2] # NOTE keep step 10 setting as 1!!!!!
    step1_benchmarks = [[0,0],[1.01,0],[1.025,0],[1.05,0],[0.25,0]]
    min_spacing = 0.33
    iter_window_len = 0.1
    step15_usage = 1
    step2_usage = 5
    step3_usage = 2
    crazy_var = 60
    window_length = 200
    setting = Setting(step1_usage,step1_benchmarks,step15_usage,step2_usage,step3_usage,crazy_var,min_spacing,iter_window_len,window_length)
    return setting

def main():
    sets = ['hayden1','hayden2','test1','test2','test3','roy1','filip1','filip2']
    data, actual = choose_data('hayden2') 
    setting = initialize_setting()
    # emulator(data,actual, setting)
    # EXPERIMENT1(sets,setting,'EXPERIMENT1_2.CSV') # ALL SETS
    EXPERIMENT2(['filip2','hayden2','roy1'],'EXPERIMENT2_1.CSV')
    # print_data(data)

main()