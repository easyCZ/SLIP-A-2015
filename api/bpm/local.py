import json

class BPMServices(object):

    PEAK =  205
    EXTRAPOLATION = 2
    REACH_BACK = 0.15

    def __init__(self, data):
        self.data = data

    # def avg_volt(self):
    #     sum = 0
    #     count = 0
    #     for time, volts in self.data.items():
    #         sum += volts
    #         count += 1
    #     avg = float(sum)/count
    #     return avg

    # def peak_benchmark(self):
    #     avg = self.avg_volt()
    #     # There are two options I'd like to test at this point. Comment out one or the other.
    #     # 1) PEAK = avg*a, where a is an element of [1.01,1.3)
    #     a = 1.05
    #     peak_benchmark = avg*a
    #     # 2) PEAK = avg + a where a is an element of [5,30]
    #     a = 15
    #     peak_benchmark = avg + 15
    #     # In both cases I will need to derive an experiment that determines which method is the most accurate.
    #     return peak_benchmark

    # def extrapolation_benchmark(self):
    #     avg = self.avg_volt()
    #     PEAK = self.peak_benchmark()
    #     a = 0.3 # subject to experiments
    #     # extrapolation_benchmark = (PEAK - avg)*a
    #     return extrapolation_benchmark

    def get_bpm(self):
        peaks = self.get_peaks()
        keys = [int(key) for (key, volts) in peaks]
        if not keys:
            return 0
        avg = (max(keys) - min(keys)) / (len(peaks) - 1)
        Expected_BPM = 60.0 * 1000.0 / avg
        return Expected_BPM


    def get_peaks(self):

        was_beat = False  # this boolean was implemented to prevent double counting beats that occur over two timestamps.
        beats = [] # list that will contain all beats in the format [timestamp, volts]
        previous_points = [[0,0] for i in range(20)] # list of the last 10 data points (from oldest to newest). List is also in the format [timestamp,volts]

        for time,volts in sorted(self.data.iteritems()):
            is_beat = False
            time = int(time)

            if previous_points[0] <> [0,0]:

                if volts > self.PEAK:   # discards data that does not exceed peak benchmark

                    regression_data = []  # preparing regression
                    for point in previous_points:
                        if int(point[0]) > time-1000*self.REACH_BACK:
                            regression_data.append(point)
                    regression_volts = self.regression(regression_data,time)
                    if volts > regression_volts + self.EXTRAPOLATION: # discards data that does not exceed extrapolation benchmark
                        if was_beat == False:
                            beats.append([time,volts])
                        is_beat = True

            # setting up next key-value pair evaluation
            previous_points.append([time,volts])
            previous_points.pop(0)
            was_beat = is_beat
        return beats

    # def get_peaks(self):
    #     is_beat = False
    #     beats = []
    #     previous_points = [[] for i in range(self.REACH_BACK + 1)]
    #     previous_points.append([0, 0])

    #     for time, volts in self.data.items():
    #         previous_volts = previous_points[self.REACH_BACK + 1][1]

    #         if volts > self.PEAK:
    #             if not is_beat:
    #                 start_time = time
    #             is_beat = True

    #         else:
    #             if is_beat:
    #                 first_point = previous_points[0]
    #                 if first_point and first_point[0] != 0 and first_point[1] != 0:
    #                     finish_time = time
    #                     predicted_voltage = self.regression(previous_points[:-1], int(start_time))

    #                     if (previous_volts > predicted_voltage + self.EXTRAPOLATION):
    #                         beats.append([start_time, previous_volts])

    #             is_beat = False
    #         previous_points.pop(0)
    #         previous_points.append([time, volts])

    #     return beats

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


def main():
    data = get_json('test_data.JSON')
    TEST = BPMServices(data)
    beats = TEST.get_peaks()
    BPM = TEST.get_bpm()
    print beats, len(beats), BPM

main()