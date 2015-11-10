# Finding coefficients in ranking algorithm by comparing results to actual ranking

# coefficients to find
#	1) 'punishment' for not participating (1 unknown - assigning non-positive number to exercise)
#	2) weight of each exercise (10 unknowns - one real element of [0,1] per exercise. Unknowns add up to 1)
#	3) weight of avg min max per exercise (3 unknowns - one real element of [0,1] for each [avg,min,max]. Unknowns add up to one.)
#
#
#


actual_ranking = [1,6,7,5,9,10,4,8,2,3]
exercises = [1,2,3,4,5,6,7,8,9,10,12]
patients = [1,2,3,4,5,6,7,8,9,10]

class patients(object):
	def __init__(self,number,scores,stats,participated,overall):
		self.number = number # integer from 1-10. patient number.
		self.scores = scores # list of floats element of [0,10]. Floats are scores for a given exercise. 
		self.stats = stats   # for n exercises this is a list containing n lists of the form [avg,min,max], where avg is the patient's avg br for a given exercise, min is the patient's min br for a given exercise... etc.
		self.participated = participated # list of booleans. True if patient participated in a gievn exercise, False if a patient did not.
		self.overall = overall # float element of [0,10]. Overall scor of patient.

def get_exercise_index(exercise):
	if exercise == 12:
		exercise_index = 10
	else:
		exercise_index = exercise - 1
	return exercise_index
		
def get_data():
	data = []
	output = []
	for i in range (1,11):
		if i == 10:
			patient = "patient10.csv" 
		else:
			patient = "patient" + "0" + str(i) + ".csv"
		f = open(patient)
		data1 = f.read()
		f.close
		data.append([])
		lines = data1.split("\r")
		lines.pop(0)
		output1 = []
		prevact = '12'
		prevbr = 0
		for line in lines:
			token = line.split()
			act = int(token[1])
			br = float(token[0].strip())
			token = [br, act]
			if prevact != act or prevbr != br:
				output1.append(token)
			prevact = act
			prevbr = br
			data[i-1].append(token)
		output.append(output1)
	return output

def initialize_patients(exercises, patients, data):
	patients_list = []
	# length = len(patients)
	for i in range(0,10):
		patients_list.append(0)
		patients_list[i] = patients(i+1,[],[],[],0)
	for patient in patients_list:
		for exercise in exercises:
			patient.scores.append(0)
			sum = 0
			count = 0
			max = 0
			min = 1000
			for tuple in data[patient.number - 1]:
				tuple_exercise = tuple[1]
				tuple_br = tuple[0]
				if tuple_exercise == exercise:
					sum += tuple_br
					count += 1
					if tuple_br < min:
						min = tuple_br
					if tuple_br > max:
						max = tuple_br
			if count == 0 or sum == 0:
				patient.participated.append(False)
				patient.stats.append(['N/A','N/A','N/A'])
			else:
				patient.participated.append(True)
				avg = sum/count
				patient.stats.append([avg,min,max])
	return patients_list
	
def get_avg_stats(patients_list, exercise):
	exercise_index = get_exercise_index(exercise)		
	count = 0
	sum = [0,0,0] # avg,min,max
	for patient in patients_list:
		if patient.participated[exercise_index]:
			count += 1
			for i in range(0,3):
				sum[i] += patient.stats[exercise_index][i]
	averages = [0,0,0] # avg, min, max
	for i in range(0,3):
		averages[i] = sum[i] / count
	return averages
	
def get_var_stats(patients_list, exercise):
	exercise_index = get_exercise_index(exercise)
	Var = [0,0,0] # AvgVar, MinVar, MaxVar
	Avg = get_avg_stats(patients_list, exercise)
	count = 0
	for patient in patients_list:
		if patient.participated[exercise_index]:
			count += 1
			for i in range(0,3):
				Var[i] += (patient.stats[exercise_index][i] - Avg[i])**2
	for i in range(0,3):
		Var[i] = Var[i] / count
	return Var
	
def get_min_stats(patients_list, exercise):
	exercise_index = get_exercise_index(exercise)
	min = [1000,1000,1000]
	for patient in patients_list:
		if patient.participated[exercise_index]:
			for i in range(0,3):
				if patient.stats[exercise_index][i] < min[i]:
					min[i] = patient.stats[exercise_index][i]
	return min
		
def get_max_stats(patients_list, exercise):
	exercise_index = get_exercise_index(exercise)
	max = [0,0,0]
	for patient in patients_list:
		if patient.participated[exercise_index]:
			for i in range(0,3):
				if patient.stats[exercise_index][i] > max[i]:
					max[i] = patient.stats[exercise_index][i]
	return max
	
# sets score for exercise for each patient to list [avg,min,max], where avg, min, max is a score out of 10 (by span).
def score_by_span(patients_list,exercise):
	exercise_index = get_exercise_index(exercise)
	max = get_max_stats(patients_list, exercise)
	min = get_min_stats(patients_list,exercise)
	for patient in patients_list:
		if patient.participated[exercise_index]:
			scores = [0,0,0]
			for i in range(0,3):
				scores[i] = 10*(1-(patient.stats[exercise_index][i] - min[i])/(max[i]-min[i]))
			patient.scores[exercise_index] = scores
		else:
			patient.scores[exercise_index] = 'N/A'
	return patients_list
	
# not running. need normal cdf
def score_by_normal(patients_list, exercise):
	exercise_index = get_exercise_index(exercise)
	mean = get_avg_stats(patients_list, exercise)
	stdev = get_Var_stats(patients_list,exercise)
	for std in stdev:
		std = std**(1/2)
	for patient in patients_list:
		if patient.participated[exercise_index]:
			scores = [0,0,0]
			for i in range(0,3):
				x = (patient.stats[exercise_index][i] - mean[i])/stdev[i]
				# if x >= 0:
					# scores[i] = (1-Normal(x))*10
				# else:
					# scores[i] = Normal(-x)*10
			patient.scores[exercise_index] = scores
		else:
			patient.scores[exercise_index] = 'N/A'
	return patients_list
	
	
patients_list = initialize_patients(exercises, patients, get_data())
score_by_span(patients_list,5)

for i in range(0,10):
	print (patients_list[i].scores)
	print (patients_list[i].stats[4])

from scipy.stats import norm
a = norm.cdf(1.96)
print (a)

# averages = sorted(averages, key = lambda x:x[1])