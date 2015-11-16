
class BPMService(object):

    PEAK = 200 # adding function that automatically sets PEAK
    EXTRAPOLATION = 10 # adding function that automatically sets EXTRAPOLATION
    REACH_BACK = 5

    def __init__(self, data):
        self.data = data

	def avg_volt(self):
		sum = 0
		count = 0
		for time, volts in self.data.items():
			sum += volts
			count += 1
		avg = float(sum)/count
		return avg

	# It won't let me call this method.
	def peak_benchmark(self):
		avg = self.avg_volt()
		# There are two options I'd like to test at this point. Comment out one or the other.
		# 1) PEAK = avg*a, where a is an element of [1.01,1.3)
		a = 1.05
		peak_benchmark = avg*a
		# 2) PEAK = avg + a where a is an element of [5,30]
		a = 15
		peak_benchmark = avg + 15
		# In both cases I will need to derive an experiment that determines which method is the most accurate.
		return peak_benchmark

    def extrapolation_benchmark(self):
        avg = self.avg_volt()
        PEAK = self.peak_benchmark()
        a = 0.3 # subject to experiments
		# extrapolation_benchmark = (PEAK - avg)*a
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

    def get_peaks(self):
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

# FOR TESTING - importing data and trying the function. It won't let me call it when it's in the class.
import json

'''def avg_volt(self):
		sum = 0
		count = 0
		for time, volts in self.data.items():
			sum += volts
			count += 1
		avg = float(sum)/count
		return avg

	# It won't let me call this method.
def peak_benchmark(self):
	avg = avg_volt(self)
	# There are two options I'd like to test at this point. Comment out one or the other.
	# 1) PEAK = avg*a, where a is an element of [1.01,1.3)
	a = 1.05
	peak_benchmark = avg*a
	# 2) PEAK = avg + a where a is an element of [5,30]
	a = 15
	peak_benchmark = avg + 15
	# In both cases I will need to derive an experiment that determines which method is the most accurate.
	return peak_benchmark

def extrapolation_benchmark(self):
	avg = avg_volt(self)
	PEAK = peak_benchmark(self)
	a = 0.3 # subject to experiments
	extrapolation_benchmark = (PEAK - avg)*a
	return extrapolation_benchmark'''

def get_json():
	with open('5sec.json') as f:
		json_data = json.loads(f.read())
		return json_data
	return {}

json_data = get_json()
window1 = BPMService(json_data)
PEAK = window1.peak_benchmark()
EXTRAPOLATION = window1.extrapolation_benchmark()
print PEAK, EXTRAPOLATION