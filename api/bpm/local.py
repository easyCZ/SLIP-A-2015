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

    def extrapolation_benchmark(self,a,b):
        avg = self.avg_volt()
        PEAK = self.peak_benchmark(a,b)
        extrapolation_benchmark = (PEAK - avg)*a + b
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
        self.EXTRAPOLATION = self.extrapolation_benchmark(extr_a,extr_b)
        is_beat = False
        beats = []
        previous_points = [[] for i in range(self.REACH_BACK + 1)]
        previous_points.append([0, 0])

        for time, volts in self.data.items():
            previous_volts = previous_points[self.REACH_BACK + 1][1]

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
            Sxy += (timestamp - Ex)*(voltage - Ey)
            Sxx =+ (timestamp - Ex)**2
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

def experiment(Subjects):
    settings = []
    for reach_back in range(5,6):
        for i in range(1,2):
            peak_a = 1+ i*0.05
            for peak_b in range(10,11):
                for j in range(6,7):
                    extr_a = 0.05*j
                    for extr_b in range(0,1):
                        settings.append(Setting(reach_back,peak_a,peak_b,extr_a,extr_b))
    for setting in settings:
        for subject in Subjects:
            peaks = subject.get_peaks(setting.reach_back,setting.peak_a,setting.peak_b,setting.extr_a,setting.extr_b)
            relevant_peaks = []
            for peak in peaks:
                if int(peak[0]) > subject.start_time and int(peak[0]) < subject.finish_time:
                    relevant_peaks.append(peak)
            beats = len(relevant_peaks)
            setting.diff = setting.diff + abs(beats - subject.actual_beats)
            print beats, subject.actual_beats
    settings.sort(key = lambda x: x.diff, reverse=False)
    for i in range(0,len(settings)):
        settings[i].print_setting()



    #         get difference in beats
    #     sum difference in beats
    # add setting with difference in beats to list
    # order list
    # return list or part of list


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
    Filip = Services(Filip_data,58,1447758840000,1447758900000)
    Subjects.append(Hayden)
    Subjects.append(Filip)
    experiment(Subjects)

if __name__ == "__main__":
    main()
