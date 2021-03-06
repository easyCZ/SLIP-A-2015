from project import settings
import requests
import math

class EcgFirebaseService(object):

    URL = settings.FIREBASE_URL + '/devices/%s/raw_ecg.json'

    def __init__(self, device_id):
        self.device_id = device_id
        self.params = {
            'orderBy': '"$key"'
        }
        self.url = self.URL % device_id

    def retrieve(self, time_from, time_to):
        time_from = math.floor(time_from.timestamp())
        time_to = math.ceil(time_to.timestamp())
        params = {
            'orderBy': '"$key"',
            'startAt': '"%s"' % time_from,
            'endAt': '"%s"' % time_to
        }
        response = requests.get(self.url, params=params)
        if response.status_code != requests.codes.ok:
            response.raise_for_status()

        print(response.json())

        return response.json()


class EcgRegressionService(object):

    pass

# ECG data processing

#method converts string into float(seconds).
# def get_time(str_time):
# 	time = str_time.split(':')
# 	seconds = 3600*float(time[0]) + 60*float(time[1]) + float(time[2])
# 	return seconds
#
# # converts float (number of seconds) to string(time).
# def convert_time(float_time):
# 	time = float_time
# 	after_decimal = time - int(time)
# 	remainder = int(time)%3600
# 	hours = (int(time) - remainder)/3600
# 	remainder1 = remainder % 60
# 	minutes = (remainder - remainder1)/60
# 	seconds = remainder1 + round(after_decimal,3)
# 	return '%i:%i:%s' %(hours, minutes, seconds)
#
# # NOT USED. Takes in two data points and returns voltage resulting from linear extrapolation of those two datapoints.
# def predictVOLT(x1,x2,y1,y2,x):
# 	m = (y2-y1)/(x2-x1)
# 	b = y1 - m*x1
# 	y = m*x + b
# 	return y
#
# # finds line of best fit by minimizing residual - used in peaks.
# def regression(list, x):
# 	length = len(list)
# 	Ey = 0    # Expectation of y
# 	Ex = 0    # Expectatio of x
# 	for element in list:
# 		Ey += element[1]
# 		Ex += element[0]
# 	Ey = Ey/length
# 	Ex = Ex/length
# 	Sxy = 0 # sum of squares xy
# 	Sxx = 0 # sum of squares x
# 	for element in list:
# 		Sxy += (element[0] - Ex)*(element[1] - Ey)
# 		Sxx =+ (element[0] - Ex)**2
# 	B1 = Sxy/Sxx
# 	B0 = Ey - B1*Ex
# 	y = B1*x + B0
# 	return y
#
# # getting data
# def get_data():
# 	f = open("ecg.csv")
# 	data_import = f.read()
# 	f.close()
# 	data1 = data_import.split("\n")
# 	data1 = data1[45:-5]
# 	data = []
# 	for element in data1:
# 		tuple = element.split(",")
# 		if len(tuple ) == 2:
# 			timestamp = get_time(tuple[0])
# 			voltsignal = float(tuple[1])
# 			data.append([timestamp,voltsignal])
# 	return data
#
# # method looks for peaks and then eliminates peaks using extrapolation. Method can be improved given necessity and time. Improvement would be to change 'reach_back' depending on density of datapoints.
# def peaks(data):
# 	peak = 200 		  # these values should be changed after experimentation.
# 	extrapolation = 10 # these values should be changed after experimentation.
# 	reach_back = 5   # these values should be changed after experimentation.
# 	beat = False
# 	beats = []
# 	prev_points = []
# 	for i in range(0,reach_back+1):
# 		prev_points.append([])
# 	prev_points.append([0,0])
# 	for tuple in data:
# 		time = tuple[0]
# 		volts = tuple[1]
# 		prev_Volts = prev_points[reach_back+1][1]
# 		if volts > peak:
# 			if beat == False:
# 				start_time = time
# 			beat = True
# 		else:
# 			if beat == True:
# 				if prev_points[0] <> [] and prev_points[0] <> [0,0]:
# 					finish_time = time
# 					predicted_Voltage = regression(prev_points[:-1], start_time)
# 					if prev_Volts > predicted_Voltage + extrapolation:
# 						beats.append([convert_time(start_time), prev_Volts]) # only appends start time because datapoints are too far apart.
# 			beat = False
# 		prev_points.pop(0)
# 		prev_points.append([time, volts])
# 	return beats # output is a list containing starting and finishing times of beats.
#
# def main():
# 	data = get_data()
# 	# print data
# 	beats = peaks(get_data())
# 	print beats
# 	print len(beats)
#
# main()
#
