# normal

# class normal(object):
# 	def __init__(self,)
		

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

def normalcdf(x):
	if x > 4 or x < 0:
		return "ERROR"
	NormalCDF = get_normalcdf_data()
	first2values = int(x*10)/10.0
	row_index = int(10*first2values)
	thirdvalue = round(x,2) - first2values
	col_index = int(thirdvalue * 100)
	return 0.5+NormalCDF[row_index][col_index+1]

def main():
	NormalCDF = get_normalcdf_data()
	# for row in NormalCDF:
	# 	print row
	for x in [0.1,0.2,2.65745,3.54654,1.2543221]:
		print normalcdf(x)

	
main()

