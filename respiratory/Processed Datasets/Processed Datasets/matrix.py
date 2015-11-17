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
	I = matrix(I)
	return I

Test1 = [0,1,2,3,4,5,6,7]
Test = []
for i in range(0,len(Test1)):
	Test.append([0,0,0,0,0,0,0,0])
	for j in range(0,len(Test1)):
		Test[i][j] += j

class matrix(object):
	def __init__(self,rows):
		self.row_dim = len(rows)
		self.col_dim = len(rows[0])
		self.rows = rows
		#initializing self.cols
		self.cols = []
		for i in range(0,self.col_dim):
			self.cols.append([])
			for row in self.rows:
				self.cols[i].append(row[i])
	def transpose(self):
		rows = self.rows
		self.rows = self.cols
		self.cols = rows
		row_dim = self.row_dim
		self.row_dim = self.col_dim
		self.col_dim = row_dim
		return self

	def element(self,i,j):
		if i < 1 or i > self.row_dim or j < 1 or j > self.col_dim:
			return "ERROR"
		element = self.rows[i-1][j-1]
		return element

	def row(self,i):
		row = self.rows[i-1]
		return row

	def col(self,j):
		return self.cols[j-1]
	
	def matrix_print(self):
		for i in range(1,self.row_dim+1):
			print self.row(i)
	
	def change_row(self,i,new_row):
		self.rows[i-1] = new_row
		self = matrix(self.rows)
		return self
	
def transpose(A):
	A_transpose = matrix(A.cols)
	return A_transpose

def multiply(A,B):
	row_dim = A.row_dim
	col_dim = B.col_dim
	if A.col_dim == B.row_dim:
		sum_length = A.col_dim
	else:
		return "ERROR"
	AB = zeros(row_dim,col_dim)
	for i in range(0,row_dim):
		for j in range(0,col_dim):
			for k in range(0,sum_length):
				AB[i][j] = AB[i][j] + A.element(i+1,k+1)*B.element(k+1,j+1)
	AB = matrix(AB)
	return AB

def LU_decomp(A):
	L = identity(A.row_dim)
	U = identity(A.row_dim)


A = matrix(Test)
A_transpose = transpose(A)
I = identity(A.row_dim)

AB = multiply(A_transpose,A)
AB.matrix_print()