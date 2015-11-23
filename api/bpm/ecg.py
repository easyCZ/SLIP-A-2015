import json

# I will fix up the ecg code here

class ecg_services(object):
	def __init__(self, data, actual_beats, start_time, finish_time):
		self.data = data
		self.start_time = start_time
		self.finish_time = finish_time
		self.actual_beats = actual_beats

	def print_data(self):
		for time,volts in sorted(self.data.iteritems()):
			if  int(time) > self.start_time and int(time) < self.finish_time: # only prints key-value pairs from relevant time-window
				print time, volts 

	def interval_print(self,i):
		start_time = self.start_time + (i-1)*5000
		finish_time = start_time + 5000
		for time,volts in sorted(self.data.iteritems()):
			if  int(time) > start_time and int(time) < finish_time: # only prints key-value pairs from relevant time-window
				print time, volts 
					
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

	def filter_peaks(self,original_beats):
		beats = []
		prev_time = 0
		prev_volts = 0
		for beat in original_beats:
			time = beat[0]
			volts = beat[1]
			if time - prev_time > 280:
				beats.append(beat)
			elif volts > prev_volts and prev_volts <> 0:
					beats.pop()
					beats.append(beat)
					
			prev_time = time
			prev_volts = volts
		return beats
				
	def peaks(self, reach_back, extrapolation, peak):
		
		was_beat = False  # this boolean was implemented to prevent double counting beats that occur over two timestamps.
		beats = [] # list that will contain all beats in the format [timestamp, volts]
		previous_points = [[0,0] for i in range(30)] # list of the last 10 data points (from oldest to newest). List is also in the format [timestamp,volts]

		for time,volts in sorted(self.data.iteritems()):
			is_beat = False
			time = int(time)

			if time > self.start_time and time < self.finish_time: # discards data that does not match required time frame.

				if volts > peak:	# discards data that does not exceed peak benchmark
					
					regression_data = []  # preparing regression
					for point in previous_points:
						if int(point[0]) > time-1000*reach_back:
							regression_data.append(point)
					regression_volts = self.regression(regression_data,time)
					if volts > regression_volts + extrapolation: # discards data that does not exceed extrapolation benchmark
						if was_beat == False:
							beats.append([time,volts])
						is_beat = True
				
			# setting up next key-value pair evaluation
			previous_points.append([time,volts])
			previous_points.pop(0)
			was_beat = is_beat
		return beats

	def double_peaks(self,peak):

		peak = peak

		was_beat = False  # this boolean was implemented to prevent double counting beats that occur over two timestamps.
		beat_pairs = [[]] # list that will contain all beats in the format [timestamp, volts]
		first_pair = True # just to help the adding of beat pairs
		beat_volts = []	  # to get the maximum volts of a beat

		for time,volts in sorted(self.data.iteritems()):
			is_beat = False
			time = int(time)

			if time > self.start_time and time < self.finish_time: # discards data that does not match required time frame.

				if volts > peak:	# discards data that does not exceed peak benchmark
			
						if was_beat == False:
							start_time = time
						is_beat = True
			
			if is_beat:
				beat_volts.append(volts)

			# a complicated way to add to the list of "beat pairs"
			if was_beat and not is_beat:
				max_volts = max(beat_volts)
				finish_time = previous_time
				if first_pair: # adding first pair
					beat_pairs.pop()
					beat_pairs.append([[start_time,finish_time,max_volts],[]])
					first_pair = False
				elif beat_pairs[-1][1] == []: # adding to existing pair
					beat_pairs[-1].pop()
					beat_pairs[-1].append([start_time, finish_time,max_volts])
				else: # adding new pair
					beat_pairs.append([[start_time,finish_time,max_volts],[]])

			# setting up next key-value pair evaluation
			was_beat = is_beat
			previous_time = time
			if is_beat == False:
				beat_volts = []
		
		beats = []
		for pair in beat_pairs:
			
			item1_start = pair[0][0]
			item1_finish = pair[0][1]
			item1_volts = pair[0][2]
			
			if pair[1] == []:
				beats.append([item1_start,item1_volts])
			else:
				item2_start = pair[1][0]
				item2_finish = pair[1][1]
				item2_volts = pair[1][2]
				item1_time = item1_finish-item1_start
				item2_time = item2_finish-item2_start
				if item1_time > item2_time:
					beats.append([item2_start,item2_volts])
				elif item2_time > item1_time:
					beats.append([item1_start,item1_volts])
				else:
					if item1_volts >= item2_volts:
						beats.append([item1_start,item1_volts])
					else:
						beats.append([item2_start,item2_volts])
		return beats

	def BPM(self,peaks):
		keys = [int(key) for (key, volts) in peaks]
		if not keys:
			return 0
		avg = (max(keys) - min(keys))/(len(peaks) - 1)
		Expected_BPM = round(60.0 * 1000/avg,0)
		bound = round(60000/float((max(keys)-min(keys)))*(len(peaks) + 1),0)
		if Expected_BPM <= bound:
		    return Expected_BPM
		else:
			return bound

def get_json(file_name):
    with open(file_name) as f:
        json_data = json.loads(f.read())
        return json_data
    return {}
    
def initialize_subjects():
	Subjects = []
	hayden_data = get_json('Hayden_raw_ecg.json')
	filip_data = get_json('Filip_raw_ecg.json')
	Filip = ecg_services(filip_data,23,1447758840000, 1447758900000)
	Hayden = ecg_services(hayden_data,68, 1447759200000,1447759260000)
	Subjects.append(Hayden)
	Subjects.append(Filip)
	return Subjects

def print_result(Subjects):
	for subject in Subjects:
		beats = subject.peaks(0.13,10,198)
		# beats = subject.double_peaks(190)
		# beats1 = subject.filter_peaks(beats)
		for beat in beats:
			print beat

def peaks_experiment(Subjects):
	reach_back = 0.13
	extrapolation = 10
	peak = 198
	settings = []
	
	for peak in range(190,205):
		for extrapolation in range(0,21):
			for i in range(0,20):
				reach_back = 0.12 + i*0.01	

				beat_diff = 0
				for subject in Subjects:
					beats = subject.peaks(reach_back,extrapolation,peak)
					subject_beat_diff = abs(len(beats)-subject.actual_beats)
					beat_diff += subject_beat_diff
				settings.append([reach_back, extrapolation, peak, beat_diff])

	settings.sort(key = lambda x: x[3], reverse=True)
	for setting in settings:
		print setting

def double_peaks_experiment(Subjects):
	peak = 198
	settings = []
	
	for peak in range(180,210):

		beat_diff = 0
		for subject in Subjects:
			beats = subject.double_peaks(peak)
			subject_beat_diff = abs(len(beats)-subject.actual_beats)
			beat_diff += subject_beat_diff
		settings.append([peak, beat_diff])

	settings.sort(key = lambda x: x[1], reverse=True)
	for setting in settings:
		print setting

def BPM_experiment(Subjects):
	
	for subject in Subjects:
		subject.beats = subject.peaks(0.12,11,194)

	results = []
	
	for window_length in range(4,61):

		total_difference = 0
		subject_count = 0
		no_of_intervals = int(60/window_length)

		for subject in Subjects:
			
			if subject == Subjects[0]:

				subject_count += 1

				beats = subject.beats

				intervals = []
				for i in range(1,no_of_intervals+1):
					start_time = subject.start_time + (i-1)*1000*window_length
					finish_time = subject.start_time + i*1000*window_length
					intervals.append([start_time,finish_time])

				for interval in intervals:
					interval_beats = []
					for beat in beats:
						if beat[0] > interval[0] and beat[0] < interval[1]:
							interval_beats.append(beat)
					interval_bpm = subject.BPM(interval_beats)
					interval_diff = abs(interval_bpm - subject.actual_beats)
					total_difference += interval_diff
				
		avg_diff = float(total_difference)/no_of_intervals/subject_count
		results.append([window_length, avg_diff])

	for result in results:
		print result

def EXPERIMENT(Subjects):
	Hayden = Subjects[0]
	results = [] # [reach_back, extrapolation, peak, avg_BPM_diff(at 5 sec window length), len(beats), Hayden.actual_beats]

	window_length = 5
	total_difference = 0
	no_of_intervals = int(60/window_length)

	intervals = []
	for i in range(1,no_of_intervals+1):
		start_time = Hayden.start_time + (i-1)*1000*window_length
		finish_time = Hayden.start_time + i*1000*window_length
		intervals.append([start_time,finish_time])

	for peak in range(185,209):
		for extrapolation in range(0,25):
			for i in range(0,10):
				reach_back = 0.12+i*0.01

				total_difference = 0

				beats = Hayden.peaks(reach_back,extrapolation,peak)

				count = 0

				for interval in intervals:
					interval_beats = []
					for beat in beats:
						if beat[0] > interval[0] and beat[0] < interval[1]:
							interval_beats.append(beat)
					if len(interval_beats) > 1:
						interval_bpm = Hayden.BPM(interval_beats)
						interval_diff = abs(interval_bpm - Hayden.actual_beats)
						total_difference += interval_diff
						count += 1
							
				avg_diff = float(total_difference)/count
				results.append([reach_back, extrapolation, peak, avg_diff, len(beats), Hayden.actual_beats])

	results.sort(key = lambda x: x[3], reverse=True)
	for result in results:
		print result



def main():
	Subjects = initialize_subjects()
	# Subjects[0].print_data()
	EXPERIMENT(Subjects)
	# Subjects[0].beats = Subjects[0].peaks(0.12,11,194)
	# print Subjects[0].beats

main()