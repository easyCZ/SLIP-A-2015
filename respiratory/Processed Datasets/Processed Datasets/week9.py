# PART 1 - INITIALIZATION

actual_ranking = [1,6,7,5,9,10,4,8,2,3] # actual_ranking[i] = patient.number of rank
actual_ranking1 = [1,9,10,7,4,2,3,8,5,6] # actual_ranking1[i] = rank of patient[i]
exercises = [1,2,3,4,5,6,7,8,9,10,12]
patients = [1,2,3,4,5,6,7,8,9,10]

class patients(object):
	def __init__(self,number,scores,stats,participated,rank,actual_rank,overall):
		self.number = number # integer from 1-10. patient number.
		self.scores = scores # list of floats element of [0,10]. Floats are scores for a given exercise. 
		self.stats = stats   # for n exercises this is a list containing n lists of the form [avg,min,max,var], where avg is the patient's avg br for a given exercise, min is the patient's min br for a given exercise... etc.
		self.participated = participated # list of booleans. True if patient participated in a gievn exercise, False if a patient did not.
		self.rank = rank
		self.actual_rank = actual_rank
		self.overall = overall # float element of [0,10]. Overall score of patient.

class matrix(object):
	def __init__(self,rows):
		self.row_dim = len(rows)
		self.col_dim = len(rows[0])
		self.rows = rows
		self.cols = []
		for i in range(0,self.col_dim):
			self.cols.append([])
			for row in self.rows:
				self.cols[i].append


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

#initializes patients_list, our main list of objects.
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
				patient.stats.append(['N/A','N/A','N/A','N/A'])
			else:
				patient.participated.append(True)
				avg = sum/count
				sum = 0
				for tuple in data[patient.number -1]:
					tuple_exercise = tuple[1]
					tuple_br = tuple[0]
					if tuple_exercise == exercise:
						sum = sum + (tuple_br - avg)**2
				var = sum/count
				patient.stats.append([avg,min,max,var])
	return patients_list

def get_exercise_index(exercise):
	if exercise == 12:
		exercise_index = 10
	else:
		exercise_index = exercise - 1
	return exercise_index

# PART 2 - SCORING

# returns the average of avg,min,max,var
def get_avg_stats(patients_list, exercise):
	exercise_index = get_exercise_index(exercise)		
	count = 0
	sum = [0,0,0,0] # avg,min,max,var
	for patient in patients_list:
		if patient.participated[exercise_index]:
			count += 1
			for i in range(0,4):
				sum[i] += patient.stats[exercise_index][i]
	averages = [0,0,0,0] # avg, min, max,var
	for i in range(0,4):
		averages[i] = sum[i] / count
	return averages

# returns the variance of avg,min,max,var
def get_var_stats(patients_list, exercise):
	exercise_index = get_exercise_index(exercise)
	Var = [0,0,0,0] # AvgVar, MinVar, MaxVar, VarVar
	Avg = get_avg_stats(patients_list, exercise)
	count = 0
	for patient in patients_list:
		if patient.participated[exercise_index]:
			count += 1
			for i in range(0,4):
				Var[i] += (patient.stats[exercise_index][i] - Avg[i])**2
	for i in range(0,4):
		Var[i] = Var[i] / count
	return Var

# returns the minimum avg,min,max,var
def get_min_stats(patients_list, exercise):
	exercise_index = get_exercise_index(exercise)
	min = [1000,1000,1000,1000]
	for patient in patients_list:
		if patient.participated[exercise_index]:
			for i in range(0,4):
				if patient.stats[exercise_index][i] < min[i]:
					min[i] = patient.stats[exercise_index][i]
	return min

# returns the maximum avg,min,max,var
def get_max_stats(patients_list, exercise):
	exercise_index = get_exercise_index(exercise)
	max = [0,0,0,0]
	for patient in patients_list:
		if patient.participated[exercise_index]:
			for i in range(0,4):
				if patient.stats[exercise_index][i] > max[i]:
					max[i] = patient.stats[exercise_index][i]
	return max

# scoring method 1 := sets score for exercise for each patient to list [avg,min,max,var], where avg, min, max,var is a score out of 10 (by span).
def score_by_span(patients_list,exercise):
	exercise_index = get_exercise_index(exercise)
	max = get_max_stats(patients_list, exercise)
	min = get_min_stats(patients_list,exercise)
	for patient in patients_list:
		if patient.participated[exercise_index]:
			scores = [0,0,0,0]
			for i in range(0,4):
				scores[i] = 10*(1-(patient.stats[exercise_index][i] - min[i])/(max[i]-min[i]))
			patient.scores[exercise_index] = scores
		else:
			patient.scores[exercise_index] = 'N/A'
	return patients_list

# leading up to scoring method 2
def get_normalcdf_data():
	f = open("normalcdf.csv")
	Input = f.read()
	f.close
	Output1 = Input.split("\n")
	Output2 = []
	for row in Output1:
		a = row.split(" ")
		Output2.append(a)
	# Output = Output.split
	for i in range(0,4):
		Output2.pop(0)
	Output2.pop()
	Output = []
	for index,row in enumerate(Output2):
		Output.append([])
		for element in row:
			if element <> '' and element <> ' ' and element <> '  ':
				element = float(element)
				Output[index].append(element)
	return Output

# leading up to scoring method 2
def normalcdf(x):
	if x > 4 or x < 0:
		return "ERROR"
	NormalCDF = get_normalcdf_data()
	first2values = int(x*10)/10.0
	row_index = int(10*first2values)
	thirdvalue = round(x,2) - first2values
	if thirdvalue == 0.1:
		row_index += 1
		col_index = 0
	else:
		col_index = int(thirdvalue * 100)
	return 0.5+NormalCDF[row_index][col_index+1]

# scoring method 2 := scores by normal distribution
def score_by_normal(patients_list, exercise):
	exercise_index = get_exercise_index(exercise)
	mean = get_avg_stats(patients_list, exercise)
	stdev = get_var_stats(patients_list,exercise)
	for std in stdev:
		std = std**(1/2)
	for patient in patients_list:
		if patient.participated[exercise_index]:
			scores = [0,0,0,0]
			for i in range(0,4):
				x = (patient.stats[exercise_index][i] - mean[i])/stdev[i]
				if x >= 0:
					scores[i] = (1-normalcdf(x))*10
				else:
					scores[i] = normalcdf(-x)*10
			patient.scores[exercise_index] = scores
		else:
			patient.scores[exercise_index] = 'N/A'
	return patients_list
	
# cutting multiple scores down to one.
def apply_weights(patients_list,Wavg,Wmin,Wmax,Wvar):
	for patient in patients_list:
		for exercise_index,exercise_score in enumerate(patient.scores):
			if patient.participated[exercise_index]:
				patient.scores[exercise_index] = exercise_score[0]*Wavg + exercise_score[1]*Wmin + exercise_score[2]*Wmax + Wvar*exercise_score[3]
	return patients_list

# applying above methods to patients_list
def exercise_scores(patients_list, exercises):
	for exercise in exercises:
		score_by_normal(patients_list,exercise)
	apply_weights(patients_list,0.5,0,0,0.5)
	return patients_list

# PART 3 - machine learning
# Using regression to devise a formula that gives patients a score out of 10, based on the data generated by one of these tests.

# just to make manipulation easier
def list_to_int(b):
	for i in range(0,len(b)):
		b[i] = b[i][0]
	return b

# just to make manipulaiton easier
def int_to_list(b):
	for i in range(0,len(b)):
		b[i] = [b[i]]
	return b

#for regression
def get_X(patients_list):
	X = []
	for patient in patients_list:
		for i in range(0,len(patient.scores)):
			if patient.participated[i] == False:
				patient.scores[i] = 0
		X.append(patient.scores)
	return X

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

def multiply_row(A,i,factor):
	col_dim = len(A[0])
	for j in range(0,col_dim):
		A[i][j] = A[i][j]*factor
	return A
	
# takes triangular matrix T and solves for x in Tx = y	
# DOESN'T WORK IF MATRIX ISN'T SQUARE
def backsub(T,y):
	y = list_to_int(y)
	row_dim = len(T)
	col_dim = len(T[0])
	x = []
	for i in range(0,col_dim):
		x.append(0)
	x[col_dim-1] = y[row_dim-1]/float(T[row_dim-1][col_dim-1])
	rows = reversed(range(0,col_dim-1))
	for i in rows:
		x[i] = float(y[i])
		for j in range(i+1,col_dim):
			x[i] -= T[i][j]*x[j]
		x[i] = x[i]/T[i][i]
	return x

# returns n by m matrix of zeros
def zeros(n,m):
	output = []
	for i in range(0,n):
		output.append([])
		for j in range(0,m):
			output[i].append(0)
	return output

def identity(n):
	I = zeros(n,n)
	for i in range(0,n):
		I[i][i] = 1
	return I

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

# used in regression
def transpose(X):
	X_transpose = []
	col_dim = len(X[0])
	row_dim = len(X)
	for i in range(0,col_dim):
		X_transpose.append([])
		for j in range(0,row_dim):
			X_transpose[i].append(X[j][i])
	return X_transpose

# used in regression
# applies row operations to A until it is the identity matrix I. applies the same row operations to the identity to form A_inverse
# NOT WORKING. WILL FIX ANOTHER TIME.
def Gaussian_inverse(A):
	dim = len(A)
	A_inverse = identity(dim)
	for i in range(0,dim):
		if A[i][i] == 0:
			count = 0
			while A[i+count][i] == 0:
				count += 1
				if i+count > dim:
					return "failure"
					break
			row_swap(A,i,i+count)
			row_swap(A_inverse,i,i+count)
		multiply_row(A,i,1/A[i][i])
		multiply_row(A_inverse,i,1/A[i][i])
		for j in range(i+1,dim):
			row_add(A_inverse,i,j,-A[j][i]/A[i][i])
			row_add(A,i,j,-A[j][i]/A[i][i])
	for k in reversed(range(1,dim)):	
		for i in reversed(range(0,k)):
			print i
			row_add(A,k,i,-A[i][k])
			row_add(A_inverse,k,i,-A[i][k])
	return A_inverse

# Takes a matrix A and returns triangular matrix T and corresponding vector b
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

def regression(patients_list,exercises,target_scores):
	exercise_scores(patients_list,exercises)
	y = int_to_list(target_scores)
	X = get_X(patients_list)
	Tb = Gaussian(X,y)
	T = Tb[0]
	b = Tb[1]
	B = backsub(T,b) # will need to make changes here
	for i in range(0,len(B)):
		B[i] = max(0,B[i])
	return B

def main():
	data = get_data()
	patients_list = initialize_patients(exercises, patients,data)
	exercise_scores(patients_list,exercises)
	X = get_X(patients_list)
	X_transpose = transpose(X)
	G = Gaussian_inverse(multiply(X_transpose,X))
	print multiply(G,multiply(X_transpose,X))

# def main():
# 	data = get_data()
# 	patients_list = initialize_patients(exercises, patients,data)
# 	exercise_scores(patients_list, exercises)
# 	for patient in patients_list:
# 		# print patient.stats
# 		print patient.scores

main()
