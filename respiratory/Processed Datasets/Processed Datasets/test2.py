# analysis over all patients

# miscellaneous

def zeros(n):
	zeros = []
	for i in range (0,n):
		zeros.append(0)
	return zeros

# initializing - 
# function takes no args (opens patient CSV files). 
# Function returns a list containing one list per patient. Each patient list contains all unique tuples that are found in the patient's CSV file.
def initialize():
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
			if prevact <> act or prevbr <> br:
				output1.append(token)
			prevact = act
			prevbr = br
			data[i-1].append(token)
		output.append(output1)
	return output
# print initialize()

# Rank by exercise
# Function ranks patients per exercise and gives scores per exercise. Scoring is as outlined below the function.
# ASSUMPTIONS - if there is no data or breathing rate is zero, it is assumed that the patient was not able to carry out the required exercise. 0 points are awarded in this case.

def RankByPoints(data):
	exercises = [1,2,3,4,5,6,7,8,9,10]
	patients = [1,2,3,4,5,6,7,8,9,10]
	scores = []
	for patient in patients:
		scores.append([patient,0])
	for exercise in exercises:
		averages = []
		not_participated = []
		for patient in patients:
			sum = 0
			count = 0
			for tuple in data[patient-1]:
				if tuple[1] == exercise:
					sum += tuple[0]
					count += 1
			if count == 0 or sum == 0:
				not_participated.append([patient, 0])
			else:
				average = sum/count
				average = [patient, average]
				averages.append(average)
		averages = sorted(averages, key = lambda x:x[1])
		if not_participated <> []:
			for element in not_participated:
				averages.append(element)
		for i in range(0,10):
			if averages[i][1] <> 0:
				scores[averages[i][0]-1][1] += 10 - i
	scores = sorted(scores, key = lambda x:x[1], reverse = True)
	ranking = []
	for tuple in scores:
		ranking.append(tuple[0])
	return ranking
# scoring is done as follows
# 0 br or no data => 0 points
# otherwise, patients are ranked from lowest to highest breathing rate
# 1st place => 10 points
# 2nd place => 9 points
#.. and so on.
	
print RankByPoints(initialize())

# Not finished
def RankbyAvg(data):
	exercises = [1,2,3,4,5,6,7,8,9,10]
	patients = [1,2,3,4,5,6,7,8,9,10]
	scores = []
	for patient in patients:
		scores.append([patient,0])
	

	
