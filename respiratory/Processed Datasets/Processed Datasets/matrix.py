Test1 = [1,2,3,4,5,6,7,8]
Test = []
for i in range(0,len(Test1)):
	Test.append([0,0,0,0,0,0,0,0])
	for j in range(0,len(Test1)):
		Test[i][j] += j/11.0+16/9.0 + i*22/19.6

y = [[4,5,6,7,2,3,4,5]]

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

class matrix(object):
	def __init__(self,rows):
		self.rows = rows
		self.row_dim = len(rows)
		self.col_dim = len(rows[0])
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

	def change_element(self,i,j,new_element):
		self.rows[i-1][j-1] = new_element
		self = matrix(self.rows)
		return self
	
	# adding i*factor to k
	def row_add(self,i,k,factor):
		row = self.row(i)
		rowi_times_factor = scalar_multiply_list(factor, row)
		new_row = add_list(rowi_times_factor,self.row(k))
		self.change_row(k,new_row)
		return self

	def row_multiply(self,i,factor):
		new_row = scalar_multiply_list(factor,self.row(i))
		self.change_row(i,new_row)
		return self

	def scalar(self,scalar):
		for i in range(1,self.row_dim+1):
			for j in range(1,self.col_dim+1):
				self.change_element(i,j,scalar*self.element(i,j))
		return self

	def row_swap(self,i,j):
		rowi = self.row(i)
		self.change_row(i,self.row(j))
		self.change_row(j,rowi)
		return self

def transpose(A):
	A_transpose = matrix(A.cols)
	return A_transpose

def add(A,B):
	row_dim = A.row_dim
	col_dim = A.col_dim
	A_plus_B = matrix(zeros(row_dim,col_dim))
	if A.row_dim <> B.row_dim or A.col_dim <> B.col_dim:
		return "ERROR"
	else:
		for i in range(1,row_dim+1):
			for j in range(1,col_dim+1):
				A_plus_B.change_element(i,j,A.element(i,j)+B.element(i,j))
	return A_plus_B

def add_list(A,B):
	A = [A]
	B = [B]
	A = matrix(A)
	B = matrix(B)
	A_plus_B = add(A,B)
	return A_plus_B.rows[0]

def scalar_multiply_list(scalar,A):
	output = []
	for i in range(0,len(A)):
		output.append(A[i]*scalar)
	return output

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

def LU_decomp(A): # by construction
	row_dim = A.row_dim
	col_dim = A.col_dim
	# initial
	L = identity(row_dim)
	U = identity(row_dim)
	# row 1
	U.change_row(1,A.rows[0])
	# row 2
	L.change_element(2,1,A.element(2,1)/U.element(1,1))
	for j in range(2,A.col_dim+1):
		U.change_element(2,j,A.element(2,j) - L.element(2,1)*U.element(1,j))
	# row 3 and onwards
	if row_dim >= 3:
		for i in range(3,row_dim+1):
			for j in range(1,i-1):
				sum = 0
				for k in range(1,j):
					sum = sum + L.element(i,k)*U.element(k,j)
				L.change_element(i,j,(A.element(i,j) - sum)/U.element(j,j))
			for j in range(i,row_dim+1):
				sum = 0
				for k in range(1,i):
					sum = sum + L.element(i,k)*U.element(k,j)
				U.change_element(i,j,A.element(i,j)-sum)
	return [L,U]

# changes A to lower triangular. makes appropriate changes to y
def Gaussian(A,y):
	row_dim = A.row_dim
	col_dim = A.col_dim
	if row_dim <> col_dim:
		return "ERROR"
	LHS = A
	RHS = y
	for i in range(1,col_dim+1):
		if LHS.element(i,i) == 0:
			count = 0
			while LHS.element(i+count,i) == 0:
				count += 1
				if i+count > dim:
					return "ERROR"
					break
			LHS.row_swap(i,i+count)
			RHS.row_swap(i,i+count)
		for j in range(i+1,col_dim+1):
			LHS.row_add(i,j,-LHS.element(j,i)/LHS.element(i,i))
			RHS.row_add(i,j,-LHS.element(j,i)/LHS.element(i,i))
	return [LHS,RHS]
A = matrix(Test)
y_transpose = matrix(y)
y = transpose(y_transpose)
y.matrix_print()
Gaussian = Gaussian(A,y)
Gaussian[0].matrix_print()
Gaussian[1].matrix_print()