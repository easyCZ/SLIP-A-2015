# Finding coefficients in ranking algorithm by comparing results to actual ranking

# Improvements to make
	# 1) use enumerate to remove arguments from functions.
	# 2) *Consider exercises that were completed more often to be easier and others more difficult (a lot of error here).*
	# 3) Implement householder QR decomp for regression

# coefficients to find
	# 1) 'punishment' for not participating (1 unknown - assigning non-positive number to exercise)
	# 2) weight of each exercise (10 unknowns - one real element of [0,1] per exercise. Unknowns add up to 1)
	# 3) weight of avg min max per exercise (3 unknowns - one real element of [0,1] for each [avg,min,max]. Unknowns add up to one.)

actual_ranking = [1,6,7,5,9,10,4,8,2,3] # actual_ranking[i] = patient.number of rank
actual_ranking1 = [1,9,10,7,4,2,3,8,5,6] # actual_ranking1[i] = rank of patient[i]
exercises = [1,2,3,4,5,6,7,8,9,10,12]
patients = [1,2,3,4,5,6,7,8,9,10]

class patients(object):
	def __init__(self,number,scores,stats,participated,rank,actual_rank,overall):
		self.number = number # integer from 1-10. patient number.
		self.scores = scores # list of floats element of [0,10]. Floats are scores for a given exercise. 
		self.stats = stats   # for n exercises this is a list containing n lists of the form [avg,min,max], where avg is the patient's avg br for a given exercise, min is the patient's min br for a given exercise... etc.
		self.participated = participated # list of booleans. True if patient participated in a gievn exercise, False if a patient did not.
		self.rank = rank
		self.actual_rank = actual_rank
		self.overall = overall # float element of [0,10]. Overall score of patient.

def get_exercise_index(exercise):
	if exercise == 12:
		exercise_index = 10
	else:
		exercise_index = exercise - 1
	return exercise_index

# gets data from CSVs	
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
			if prevact <> act or prevbr <> br:
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
		patients_list[i] = patients(i+1,[],[],[],0,0,0)
		patients_list[i].actual_rank = actual_ranking1[i]
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
	
# returns the average of avg,min,max
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
	
# returns the variance of avg,min,max
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

# returns the minimum avg,min,max	
def get_min_stats(patients_list, exercise):
	exercise_index = get_exercise_index(exercise)
	min = [1000,1000,1000]
	for patient in patients_list:
		if patient.participated[exercise_index]:
			for i in range(0,3):
				if patient.stats[exercise_index][i] < min[i]:
					min[i] = patient.stats[exercise_index][i]
	return min

# returns the maximum avg,min,max
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
	
# not running. need normal cdf.
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
	
# for manual testing.
def manual_score(participation_deduction, Wstats, exercises, Wexercises, patients_list):
	# getting [avg,min,max] scores for each exercise
	for exercise in exercises:
		exercise_index = get_exercise_index(exercise)
		score_by_span(patients_list,exercise)
		# turning [avg,min,max] scores into scores element of [0,10]
		for patient in patients_list:
			if patient.participated[exercise_index]:
				score = 0
				for i in range(0,3):
					score += patient.scores[exercise_index][i]*Wstats[i]
				patient.scores[exercise_index] = score
			else:
				patient.scores[exercise_index] = -participation_deduction
	for patient in patients_list:
		for exercise in exercises:
			exercise_index = get_exercise_index(exercise)
			patient.overall += Wexercises[exercise_index]*patient.scores[exercise_index]
	return patients_list

# just played around a little. Will remove from code.
def experiment():
	experiment = [0,0.2,0.4,0.6,0.8,1] # considered values for Wexercises
	Wexercises = [0.1,0.1,0.1,0.05,0.05,0.1,0.1,0.1,0.1,0.1,0.1] # starting point. Note: all values are altered below.
	Wstats = [0.5,0.25,0.25] # kept constant for this experiment.
	participation_deduction = 0.5 # kept constant for this experiment.
	patients_list = initialize_patients(exercises, patients, get_data()) # getting data as usual.
		# getting [avg,min,max] scores for each exercise and then turning them into scores out of 10
	for exercise in exercises:
		exercise_index = get_exercise_index(exercise)
		score_by_span(patients_list,exercise) # would like to replace this with score_by_normal
		# turning [avg,min,max] scores into scores element of [0,10]
		for patient in patients_list:
			if patient.participated[exercise_index]:
				score = 0
				for i in range(0,3):
					score += patient.scores[exercise_index][i]*Wstats[i]
				patient.scores[exercise_index] = score
			else:
				patient.scores[exercise_index] = -participation_deduction
	# trying 6^9 solutions for the weights of exercises. NOTE: None worked.
	for a in experiment:
		Wexercises[0] = a
		for b in experiment:
			Wexercises[1] = b
			for c in experiment:
				Wexercises[2] = c
				for d in experiment:
					Wexercises[3] = d
					for e in experiment:
						Wexercises[4] = e
						for f in experiment:
							Wexercises[5] = f
							for g in experiment:	
								Wexercises[6] = g
								for h in experiment:
									Wexercises[7] = h
									for j in experiment:
										Wexercises[8] = j
										Wexercises[9] = 1
										for W in Wexercises[:-1]:
											Wexercises[9] -= W
										valid_solution = False
										sum = 0
										for W in Wexercises:
											sum += W
										if Wexercises[9] >= 0: # checking if the sum of weights = 1. This limits results and may/should be removed and/or implemented higher up in the experiments(to increase speed).
											for patient in patients_list:
												for exercise in exercises:
													exercise_index = get_exercise_index(exercise)
													patient.overall += Wexercises[exercise_index]*patient.scores[exercise_index]
											valid_solution = True
											patients = sorted(patients_list, key = lambda x: x.overall, reverse = True)
											for n in range(0,10):
												if patients[n].number <> actual_ranking[n]:
													valid_solution = False
													break
											if valid_solution:
												print Wexercises

def apply_weights(patients_list,Wavg,Wmin,Wmax):
	for patient in patients_list:
		for exercise_index,exercise_score in enumerate(patient.scores):
			if patient.participated[exercise_index]:
				patient.scores[exercise_index] = exercise_score[0]*Wavg + exercise_score[1]*Wmin + exercise_score[2]*Wmax
	return patients_list
	
def exercise_scores(patients_list, exercises):
	for exercise in exercises:
		score_by_span(patients_list,exercise)
	apply_weights(patients_list,0.5,0.25,0.25)
	return patients_list
						
def get_X(patients_list):
	X = []
	for patient in patients_list:
		for i in range(0,len(patient.scores)):
			if patient.participated[i] == False:
				patient.scores[i] = 0
		X.append(patient.scores)
	return X
	
# Not working. Need to account for division by zero in U[j][j]
def LU_decompose(X):
	dimension = len(X)
	# creating two matrices; L and U.
	L = [] # to be lower triangular
	U = [] # to be upper triangular
	P = [] # pivot matrix. keeps track of row swaps.
	row = []
	for i in range(0,dimension):
		row.append(0)
	for i in range(0,dimension):
		L.append(row)
		U.append(row)
		P.append(row)
	# assigning values to U[i][j] and L[i][j]
	for i in range(0,dimension):
		for j in range(0,dimension):
			if i == j:
				L[i][j] = 1
			else:
				L[i][j] = X[i][j]
				for k in range(0,j-1):
					L[i][j] -= L[i][k]*U[k][j]
				L[i][j] = L[i][j]/U[j][j]
			U[i][j] = X[i][j]
			for k in range(0,j-1):
				U[i][j] -= L[i][k]*U[k][j]
	return [L,U]

def list_to_int(b):
	for i in range(0,len(b)):
		b[i] = b[i][0]
	return b

def int_to_list(b):
	for i in range(0,len(b)):
		b[i] = [b[i]]
	return b

# swap rows i and j of matrix A.
def row_swap(A,i,j):
	row_i = A[i]
	A[i] = A[j]
	A[j] = row_i
	return A
	
# In matrix A, add factor*row_i to row j.
def row_add(A,i,j,factor):
	dim_col = len(A[0])
	for k in range(0,dim_col):
		A[j][k] = A[j][k]+ factor*A[i][k]
	return A
	
# takes triangular matrix T and solves for x in Tx = y	
def backsub(T,y):
	y = list_to_int(y)
	dim = len(T)
	x = []
	for i in range(0,dim):
		x.append(0)
	x[dim-1] = y[dim-1]/float(T[dim-1][dim-1])
	rows = reversed(range(0,dim-1))
	for i in rows:
		x[i] = float(y[i])
		for j in range(i+1,dim):
			x[i] -= T[i][j]*x[j]
		x[i] = x[i]/T[i][i]
	return x

# Takes a matrix A and returns triangular matrix T
def Gaussian(A,b):
	dim = len(A)
	for i in range(0,dim):
		if A[i][i] == 0:
			count = 0
			while A[i+count][i] == 0:
				count += 1
				if i+count > dim:
					return "failure"
					break
			row_swap(A,i,i+count)
			row_swap(b,i,i+count)
		for j in range(i+1,dim):
			row_add(b,i,j,-A[j][i]/A[i][i])
			row_add(A,i,j,-A[j][i]/A[i][i])
	return [A,b]
	
# returns n by m matrix of zeros
def zeros(n,m):
	output = []
	for i in range(0,n):
		output.append([])
		for j in range(0,m):
			output[i].append(0)
	return output
	
# Takes two matrices and multiplies them.
def multiply(A,B):
	row_dim = len(A)
	col_dim = len(B[0])
	sum_length = len(A[0])
	AB = zeros(row_dim,col_dim)
	for i in range(0,row_dim):
		for j in range(0,col_dim):
			for k in range(0,sum_length):
				AB[i][j] = AB[i][j] + A[i][k]*B[k][j]
	return AB
	
def regression(patients_list,exercises,target_scores):
	exercise_scores(patients_list,exercises)
	y = target_scores
	y = int_to_list(y)
	X = get_X(patients_list)
	Tb = Gaussian(X,y)
	T = Tb[0]
	b = Tb[1]
	B = backsub(T,b)
	return B
												
data = get_data()
patients_list = initialize_patients(exercises, patients,data)
print regression(patients_list, exercises,actual_ranking1)

# ints = [1,2,556,34]
# for idx, val in enumerate(ints):
    # print idx, val