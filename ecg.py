# ECG processing

# Initializations
	# Output of initializations is a list containing tuples. Each tuple is a list with a timestamp and volt signal.
	# Initializations will need to be altered when I see the format of inputs. 

f = open("ECG_data.csv")
data_import = f.read()
f.close()
data1 = data_import.split("\n")
data = []
for element in data1:
	element.split(",")
	timestamp = float(element[3:9])
	voltsignal = float(element[11:])
	data.append([timestamp,voltsignal])
	
# Method 1 - Peak detection
# This method is the most primitive, but it works effectively for the physio data.
# The first half finds beats by looking for tuples whose voltage is over the peak voltage.
# The second half removes 'beats' that are under a certain 'duration'. 

def peaks(data):
	# part 1
	peak = 0.35 # this value should be changed after experimentation. It works for the physio data.
	beat = False
	beats = []
	for tuple in data:
		time = tuple[0]
		volts = tuple[1]
		if volts > peak:
			if beat == False:
				start_time = time
			beat = True
		else:
			if beat == True:
				finish_time = time
				beats.append([start_time, finish_time])
			beat = False
	# Part 2	
	beats1 = []
	for beat in beats:
		start = beat[0]
		finish = beat[1]
		if finish - start > 0.03:
			beats1.append(beat)
	return beats1 # output is a list containing starting and finishing times of beats.
	
print peaks(data) # prints abovementioned list
print len(peaks(data)) # gives number of beats. Number is correct for physiodata.
