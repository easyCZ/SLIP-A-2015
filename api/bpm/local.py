from services import BPMService
import json

# Hey Milan,
# the code works when I define the benchmark functions outside of the BPMService class (see the functions and code i commented out below).
# When I define the functions inside the class i keep getting a obbjecct has no attribute error. Please check it out.
# Best,
# Fil


'''def avg_volt(self):
        sum = 0
        count = 0
        for time, volts in self.data.items():
            sum += volts
            count += 1
        avg = float(sum)/count
        return avg

    # It won't let me call this method.
def peak_benchmark(self):
    avg = avg_volt(self)
    # There are two options I'd like to test at this point. Comment out one or the other.
    # 1) PEAK = avg*a, where a is an element of [1.01,1.3)
    a = 1.05
    peak_benchmark = avg*a
    # 2) PEAK = avg + a where a is an element of [5,30]
    a = 15
    peak_benchmark = avg + 15
    # In both cases I will need to derive an experiment that determines which method is the most accurate.
    return peak_benchmark

def extrapolation_benchmark(self):
    avg = avg_volt(self)
    PEAK = peak_benchmark(self)
    a = 0.3 # subject to experiments
    extrapolation_benchmark = (PEAK - avg)*a
    return extrapolation_benchmark'''
# def avg_volt(self):
#       sum = 0
#       count = 0
#       for time, volts in self.data.items():
#           sum += volts
#           count += 1
#       avg = float(sum)/count
#       return avg

#   # It won't let me call this method.
# def peak_benchmark(self):
#   avg = avg_volt(self)
#   # There are two options I'd like to test at this point. Comment out one or the other.
#   # 1) PEAK = avg*a, where a is an element of [1.01,1.3)
#   a = 1.05
#   peak_benchmark = avg*a
#   # 2) PEAK = avg + a where a is an element of [5,30]
#   a = 15
#   peak_benchmark = avg + 15
#   # In both cases I will need to derive an experiment that determines which method is the most accurate.
#   return peak_benchmark

# def extrapolation_benchmark(self):
#   avg = avg_volt(self)
#   PEAK = peak_benchmark(self)
#   a = 0.333 # subject to experiments
#   extrapolation_benchmark = (PEAK - avg)*a
#   return extrapolation_benchmark



def get_json():
    with open('5sec.json') as f:
        json_data = json.loads(f.read())
        return json_data
    return {}

def main():
    # json_data = get_json()
    # window1 = BPMService(json_data)
    # PEAK = peak_benchmark(window1)
    # EXTRAPOLATION = extrapolation_benchmark(window1)
    # print PEAK, EXTRAPOLATION

    json_data = get_json()
    window1 = BPMService(json_data)
    PEAK = window1.peak_benchmark()
    EXTRAPOLATION = window1.extrapolation_benchmark()
    print PEAK, EXTRAPOLATION



if __name__ == "__main__":
    main()
