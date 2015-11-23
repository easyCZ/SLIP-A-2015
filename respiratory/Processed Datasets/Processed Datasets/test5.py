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
		A[j][k] += (factor*A[i][k])
	return A
	
def zeros(n,m):
	output = []
	for i in range(0,n):
		output.append([])
		for j in range(0,m):
			output[i].append(0)
	return output
	
print zeros(2,2)	
print row_add([[1,2],[2,4]],0,1, -2)
print "hello world"