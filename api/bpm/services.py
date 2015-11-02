

class BPMService(object):

    PEAK = 200
    EXTRAPOLATION = 10
    REACH_BACK = 5
    
    def __init__(self, data):
        self.data = data
        
    def get_bpm(self):
        peaks = self.get_peaks()
        keys = [int(key) for (key, volts) in peaks]
        if not keys:
            return 0
        avg = (max(keys) - min(keys)) / (len(peaks) - 1)
        return 60.0 * 1000 / avg

    def get_peaks(self):
        is_beat = False
        beats = []
        previous_points = [[] for i in range(self.REACH_BACK + 1)]
        previous_points.append([0, 0])

        for time, volts in self.data.iteritems():
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

        