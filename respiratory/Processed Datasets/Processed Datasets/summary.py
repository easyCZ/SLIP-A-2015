def calcMean(arr):
    length = len(arr)
    sum = 0
    for values in arr:
        sum += values
    mean = sum/length
    mean = round(mean)
    return mean
def calcStd(arr,mean):
    length = len(arr)
    sum = 0
    for values in arr:
        term = values - mean
        sum += pow(term,2)
    var = sum/length
    std = pow(var,0.5)
    std = round(std)
    return std
def calcMax(arr):
    sortedArray = sorted(arr)
    last5 = sortedArray[-5:]
    max = calcMean(last5)
    return max
def calcMin(arr):
    sortedArray = sorted(arr)
    first5 = sortedArray[:5]
    min = calcMean(first5)
    return min
f = open('patient09.csv')
data = f.read()
f.close()
lines = data.split('\r')
lines.pop(0)
prevAct = '12'
val = []
for line in lines:
    tokens = line.split()
    act = tokens[1]
    br = float(tokens[0].strip())
    if act == prevAct:
        val.append(br)
    else:
        avg = calcMean(val)
        if prevAct == '12':
            rest = avg
            #rest = 16
        std = calcStd(val,rest)
        maximum = calcMax(val)
        minimum = calcMin(val)
	print tokens
        # print prevAct
        # print avg
        # print std
        # print maximum
        # print minimum
        val = []
        val.append(br)
    prevAct = act
avg = calcMean(val)
maximum = calcMax(val)
std = calcStd(val,rest)
minimum = calcMin(val)
# print avg
# print std
# print maximum
# print minimum