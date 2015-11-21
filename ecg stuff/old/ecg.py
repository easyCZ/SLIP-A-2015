import json

# ECG data processing

#method converts string into float(seconds).
def get_time(str_time):
	time = str_time.split(':')
	seconds = 3600*float(time[0]) + 60*float(time[1]) + float(time[2])
	return seconds

# converts float (number of seconds) to string(time).
def convert_time(float_time):
	time = float_time
	after_decimal = time - int(time)
	remainder = int(time)%3600
	hours = (int(time) - remainder)/3600
	remainder1 = remainder % 60
	minutes = (remainder - remainder1)/60
	seconds = remainder1 + round(after_decimal,3)
	return '%i:%i:%s' %(hours, minutes, seconds)

# NOT USED. Takes in two data points and returns voltage resulting from linear extrapolation of those two datapoints.
def predictVOLT(x1,x2,y1,y2,x):
	m = (y2-y1)/(x2-x1)
	b = y1 - m*x1
	y = m*x + b
	return y

# finds line of best fit by minimizing residual - used in peaks.
def regression(values, x):
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

# getting data
def get_data():
	f = open("ecg.csv")
	data_import = f.read()
	f.close()
	data1 = data_import.split("\n")
	data1 = data1[45:-5]
	data = []
	for element in data1:
		tuple = element.split(",")
		if len(tuple ) == 2:
			timestamp = get_time(tuple[0])
			voltsignal = float(tuple[1])
			data.append([timestamp,voltsignal])
	return data

def get_json():
	with open('5sec.json') as f:
		json_data = json.loads(f.read())
		return json_data
	return {}

# method looks for peaks and then eliminates peaks using extrapolation. Method can be improved given necessity and time. Improvement would be to change 'reach_back' depending on density of datapoints.
def peaks(data):
	count = 0
	peak = 200 		  # these values should be changed after experimentation. - hope to make changes depending on data.
	extrapolation = 15 # these values should be changed after experimentation. - hope to make changes depending on data.
	reach_back = 5   # these values should be changed after experimentation. - hope to make changes depending on data.
	beat = False
	beats = []
	prev_points = []
	for i in range(0,reach_back):
		prev_points.append([])
	prev_points.append([0,0])
	for time, volts in sorted(data.items(), key=lambda x: x[0]):
		prev_Volts = prev_points[reach_back][1]
		if volts > peak:
			if beat == False:
				start_time = time
			beat = True
		else:
			if beat == True:
				if prev_points[0] <> [] and prev_points[0] <> [0,0]:
					predicted_Voltage = regression(prev_points[:-1], int(start_time))
					if prev_Volts > predicted_Voltage + extrapolation:
						beats.append([start_time, prev_Volts])
			beat = False
		prev_points.pop(0)
		prev_points.append([time, volts])
	return beats # output is a list containing starting and finishing times of beats.

def bpm(data):
	keys = [int(key) for (key, volts) in data]
	print max(keys) - min(keys)
	avg = (max(keys) - min(keys)) / (len(data)-1)
	print avg
	return 60.0 * 1000 / avg


def main():
	json_data = get_json()
	print("amount of data %d" % len(json_data))
	beats = peaks(json_data)
	print (beats)
	per_minute = bpm(beats)
	print("per minute", per_minute)
	print len(beats)

main()