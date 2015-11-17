Test1 = [1,2,3,4,5,6,7,8]
Test = []
for i in range(0,len(Test1)):
	Test.append([0,0,0,0,0,0,0,0])
	for j in range(0,len(Test1)):
		Test[i][j] += j+16/9.0

# def scalar_multiply(scalar,A):
# 	scalar_A = matrix(A.rows)
# 	for i in range(1,A.row_dim+1):
# 		for j in range(1,A.col_dim+1):
# 			scalar_A.change_element(i,j,scalar*A.element(i,j))
# 	return scalar_A