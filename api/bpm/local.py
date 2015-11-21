from services import BPMService
import json


class Services(object):

    def __init__(self, data, actual_beats, start_time,finish_time):
        self.data = data
        self.actual_beats = actual_beats
        self.start_time = start_time
        self.finish_time = finish_time

    def avg_volt(self):
        sum = 0
        count = 0
        for time, volts in self.data.items():
            sum += volts
            count += 1
        avg = float(sum)/count
        return avg

    def peak_benchmark(self,a,b):
        avg = self.avg_volt()
        peak_benchmark = avg*a + b
        return peak_benchmark

    def extrapolation_benchmark(self,peak_a, peak_b, extr_a,extr_b):
        avg = self.avg_volt()
        PEAK = self.peak_benchmark(peak_a,peak_b)
        extrapolation_benchmark = (PEAK - avg)*extr_a + extr_b
        return extrapolation_benchmark

    def get_bpm(self):
        peaks = self.get_peaks()
        keys = [int(key) for (key, volts) in peaks]
        if not keys:
            return 0
        avg = (max(keys) - min(keys)) / (len(peaks) - 1)
        Expected_BPM = 60.0 * 1000 / avg
        bound = 60/(max(keys)-min(keys))*(len(peaks) + 1)
        if Expected_BPM <= bound:
            return EXPECTED_BPM
        else:
            return bound

    def get_peaks(self,reach_back,peak_a,peak_b,extr_a,extr_b):
        self.REACH_BACK = reach_back
        self.PEAK = self.peak_benchmark(peak_a,peak_b)
        self.EXTRAPOLATION = self.extrapolation_benchmark(peak_a,peak_b,extr_a,extr_b)
        is_beat = False
        beats = []
        previous_points = [[] for i in range(self.REACH_BACK)]
        previous_points.append([0, 0])
        for time, volts in sorted(self.data.items()):

            previous_volts = previous_points[-1][1]

            if volts > self.PEAK:
                if not is_beat:
                    start_time = time
                is_beat = True

            else:
                if is_beat:
                    first_point = previous_points[0]
                    if first_point and first_point[0] != 0 and first_point[1] != 0:
                        finish_time = time
                        predicted_voltage = self.regression(previous_points[:-1], int(start_time))

                        if (previous_volts > predicted_voltage + self.EXTRAPOLATION):
                            beats.append([start_time, previous_volts])

                is_beat = False
            previous_points.pop(0)
            previous_points.append([time, volts])
        return beats

    def regression(self, values, x):
        length = len(values)
        Ey = 0    # Expectation of y
        Ex = 0    # Expectatio of x
        for element in values:
            timestamp, voltage = element
            timestamp = float(timestamp)
            Ey += voltage
            Ex += timestamp
        Ey = Ey/length
        Ex = Ex/length
        Sxy = 0 # sum of squares xy
        Sxx = 0 # sum of squares x
        for element in values:
            timestamp, voltage = element
            timestamp = float(timestamp)
            Sxy = Sxy + (timestamp - Ex)*(voltage - Ey)
            Sxx = Sxx + (timestamp - Ex)**2
        B1 = Sxy/Sxx
        B0 = Ey - B1*Ex
        y = B1*x + B0
        return y

def get_json(file_name):
    with open(file_name) as f:
        json_data = json.loads(f.read())
        return json_data
    return {}

class Setting(object):
    def __init__(self,reach_back,peak_a,peak_b,extr_a,extr_b):
        self.reach_back = reach_back
        self.peak_a = peak_a
        self.peak_b = peak_b
        self.extr_a = extr_a
        self.extr_b = extr_b
        self.diff = 0

    def print_setting(self):
        print self.reach_back, self.peak_a, self.peak_b, self.extr_a, self.extr_b, self.diff

    def get_relevant_beats(self,subject):
        peaks = subject.get_peaks(self.reach_back,self.peak_a,self.peak_b,self.extr_a,self.extr_b)
        relevant_peaks = []
        for peak in peaks:
            if int(peak[0]) > subject.start_time and int(peak[0]) < subject.finish_time:
                relevant_peaks.append(peak)
        beats = len(relevant_peaks)
        self.diff = self.diff + abs(beats - subject.actual_beats)
        return relevant_peaks

            # peaks = subject.get_peaks(setting.reach_back,setting.peak_a,setting.peak_b,setting.extr_a,setting.extr_b)
            # relevant_peaks = []
            # for peak in peaks:
            #     if int(peak[0]) > subject.start_time and int(peak[0]) < subject.finish_time:
            #         relevant_peaks.append(peak)
            # beats = len(relevant_peaks)
            # setting.diff = setting.diff + abs(beats - subject.actual_beats)

def experiment(Subjects):
    settings = []
    for reach_back in range(5,6):
        for i in range(1,2):
            peak_a = 1+ i*0.05
            for peak_b in range(6,7):
                for j in range(1,2):
                    extr_a = 0.05*j
                    for extr_b in range(5,6):
                        settings.append(Setting(reach_back,peak_a,peak_b,extr_a,extr_b))
    for setting in settings:
        for subject in [Subjects[0]]:
            beats = setting.get_relevant_beats(subject)
    settings.sort(key = lambda x: x.diff, reverse=True)
    length = len(settings)
    for i in reversed(range(1,length+1)):
        if i <5:
            settings[length-i].diff = 0
            for subject in Subjects:
                beats = settings[length-i].get_relevant_beats(subject)
                print beats, subject.actual_beats
            settings[length-i].print_setting()
        else:
            settings[length - i].print_setting()
    for subject in Subjects:
        print subject.avg_volt()

def main():
    # json_data = get_json()
    # window1 = BPMService(json_data)
    # PEAK = peak_benchmark(window1)
    # EXTRAPOLATION = extrapolation_benchmark(window1)
    # print PEAK, EXTRAPOLATION

    Subjects = []
    Filip_data = get_json('Filip_raw_ecg.json')
    Hayden_data = get_json('Hayden_raw_ecg.json')
    Hayden = Services(Hayden_data,68,1447759200000,1447759260000)
    Filip = Services(Filip_data,23,1447758840000,1447758900000)
    Subjects.append(Hayden)
    Subjects.append(Filip)
    '''peak_a = 1.0
    peak_b = 0
    extr_a = 0.0
    extr_b = 0
    # for subject in Subjects:
        # print subject.avg_volt(), subject.peak_benchmark(peak_a, peak_b), subject.extrapolation_benchmark(peak_a,peak_b,extr_a,extr_b)

    for reach_back in range(2,10):
        for i in range(0,30):
            for j in range(0,20):
                extr_a = 0.05*j
                peak_a = 1+ i*0.005
                setting1 = Setting(reach_back,peak_a,peak_b,extr_a,extr_b)
                peaks = setting1.get_relevant_beats(Hayden)
                peaks1 = setting1.get_relevant_beats(Filip)
                fil_diff = abs(len(peaks1)-Filip.actual_beats)
                hay_diff = abs(len(peaks)-Hayden.actual_beats)
                total_diff = hay_diff + fil_diff
                # if total_diff < 10:
                #     if i%2 == 0:
                #         print reach_back, peak_a,"", hay_diff, fil_diff, total_diff
                #     else:
                #         print reach_back, peak_a, hay_diff, fil_diff, total_diff
                if total_diff == 0:
                    print reach_back, peak_a, peak_b, extr_a, extr_b, total_diff'''

    setting1 = Setting(3,1.04,0,0.5,0)
    peaks = setting1.get_relevant_beats(Hayden)
    peaks1 = setting1.get_relevant_beats(Filip)
    print peaks, peaks1, len(peaks), len(peaks1)

if __name__ == "__main__":
    main()
