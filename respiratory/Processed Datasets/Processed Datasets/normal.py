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

# def 

def main():
	NormalCDF = get_normalcdf_data()
	for row in NormalCDF:
		print row

