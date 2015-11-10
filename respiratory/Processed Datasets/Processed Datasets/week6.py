class patients(object):
	def __init__(self,number,scores,stats,participated,rank,actual_rank,overall):
		self.number = number # integer from 1-10. patient number.
		self.scores = scores # list of floats element of [0,10]. Floats are scores for a given exercise. 
		self.stats = stats   # for n exercises this is a list containing n lists of the form [avg,min,max], where avg is the patient's avg br for a given exercise, min is the patient's min br for a given exercise... etc.
		self.participated = participated # list of booleans. True if patient participated in a gievn exercise, False if a patient did not.
		self.rank = rank
		self.actual_rank = actual_rank
		self.overall = overall # float element of [0,10]. Overall scor of patient.	
	
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
	
def zeros(n,m):
	output = []
	for i in range(0,n):
		output.append([])
		for j in range(0,m):
			output[i].append(0)
	return output
	
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
	
# Takes A,b from Ax = b and returns triangular matrix T along with modified b.
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
	
A = [[1,2,3],[2,3,5],[5,2,4]]
b = [[1],[2],[3]]

Tb = Gaussian(A,b)
T = Tb[0]
b = Tb[1]
			
def list_to_int(b):
	for i in range(0,len(b)):
		b[i] = b[i][0]
	return b
			
# takes triangular matrix T, vector y and solves for x in Tx = y	
def backsub(T,y):
	y = list_to_int(y)
	dim = len(T)
	print T[dim-1][dim-1]
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

print backsub(T,b)