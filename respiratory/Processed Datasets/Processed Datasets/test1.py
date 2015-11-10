# Testing

f = open("patient01.csv")
data1 = f.read()
f.close
lines = data1.split("\r")
lines.pop(0)
val = []
prevact = '12'
prevbr = 0
for line in lines:
	token = line.split()
	br = float(token[0].strip())
	act = token[1]
	if prevact <> act or prevbr <> br:
		print token
	prevact = act
	prevbr = br
	
	# act = token[1]
		# val.append(br)
	# else:
		# avg = 
		# if prevact == '12':
			