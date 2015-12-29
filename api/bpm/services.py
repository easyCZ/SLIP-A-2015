class BPMmethod(object):
    # benchmark
    # usage
    # name

    # beats LATER
    # description NO NEED

    def __init__(self,step,step_index,setting,avg):
        self.name = 'step{}{}'.format(step,step_index)
        self.step = step
        self.step_index = step_index
        if self.step == 1:
            self.usage = setting.step1_usage[step_index]
            # if self.usage <> 0:
            self.a = setting.step1_benchmarks[step_index][0]
            self.b = setting.step1_benchmarks[step_index][1]
            self.benchmark = self.a*avg + self.b
        
    def call_method(self, BPMServicesObject, iter_window):
        output = getattr(BPMServicesObject,self.name)(iter_window,self.benchmark)
        return output


class BPMServices(object):
    # objects of this class are used to neatly store information about one instance of the BPM data processing.
    # BPMServices objects should hold:
    # data := the window of data passed from the api to this program, which resulted in the given BPM.
    # start_time := the start_time of the window in thousandths of a second.
    # finish_time := the finish_time of the window in thousandths of a second.
    # length := length of window in thousandths of a second
    # BPM := The best guess for the BPM of the abovementioned data set.
    # size := number of data points in window
    # density := number of data_points per second
    # per100 := percentage of unusable data points
    # beats := times and volts of the data points that were considered beats
    # step1_methods := list containing information about which step1 methods were used in deriving the window
    # empty := no data points in dictionary
    # avg_volt := average voltage in window
    # min_volt := minimum voltage in window
    # max_volt := maximum voltage in window
    # error_warning := if true, there are some indescreptancies and most likely an error.
    # error_locations := list of locations that may contain errors, should error warning be true
    # iter_window_length := lenght of the moving window inside the previously mentioned window. Unit = seconds
    # methods := list of BPMmethod objects
    # TO BE ADDED:
    #   1)More booleans, giving info about this particular instance of the BPM

    def __init__(self, data,setting):
        self.data = data
        self.start_time = min(data)
        self.finish_time = max(data)
        self.length = self.finish_time - self.start_time
        self.size = len(self.data)
        self.empty = False
        self.min_spacing = setting.min_spacing
        self.iter_window_len = setting.iter_window_len
        ##################### maybe make into function later
        # getting density and empty
        if self.length == 0:
            self.empty = True
            self.density = 0
        else:
            self.density = self.size/(float(self.length)/1000)
        ##################### maybe make into funciton later
        self.max_volt = max(self.data.itervalues())
        self.min_volt = min(self.data.itervalues())
        ##################### maybe make into funciton later
        # getting avg_volt
        sum = 0
        count = 0
        for time, volts in self.data.items():
            sum += volts
            count += 1
        if count == 0:
            self.avg_volt = 195
        else:
            self.avg_volt = float(sum)/count
        ##################### maybe make into funciton later
        self.step1_methods = self.initialize_step1_method_objects(setting,self.avg_volt)
        self.step15_usage = setting.step15_usage
        self.step2_usage = setting.step2_usage
        self.step3_usage = setting.step3_usage

    # DEFINE FUNCTION TO get METHOD USAGE in compact form

    def initialize_step1_method_objects(self,setting,avg):
        step1_methods = []
        for i in range(0,8):
            step1_methods.append([])
            step1_methods[i] = BPMmethod(1,i,setting,avg)
        return step1_methods
    
    # BPM
    def get_bpm(self):
        # peaks = self.get_peaks()
        peaks = self.get_beats()
        if type(peaks) is str:
            return 0, text_back
        keys = [int(key) for (key, volts) in peaks]
        if not keys:
            return 0
        if len(peaks) - 1 == 0:
            return 0
        avg = (max(keys) - min(keys)) / (len(peaks)-1)
        if avg == 0:
            return 0, text_back
        Expected_BPM = 60.0 * 1000.0 / avg
        return Expected_BPM

    def get_beats(self):
        # INCOMPLETE - step 0 - moves through data 50 datapoints at a time and discards parts with crazy variances.
        # step 1 - moves through data window by window and selects potential beats. returns list of windows that are/contain a beat
        # step 1.1 - combination of methods from 1
        # step 1.5 - moves through beat windows from step 1 and merges or chooses onw window if windows overlap
        # step 2 - goes through beats and eliminates if beats that are less than min_spacing apart
        # step 3 - selects one datapoint from each beat window
        
        #STEP 1
        previous_points = [[0,0] for i in range(20)] # COULD PROBABLY BE REDUCED. list of the last 20 data points (from oldest to newest). Data points are in the format [timestamp,volts]        
        beats11 = []

        for time,volts in sorted(self.data.iteritems()):

            time = int(time)
            
            iter_window = []
            for point in previous_points:
                if int(point[0]) > time-1000*self.iter_window_len:
                    iter_window.append(point)

            if iter_window <> []:

                if self.step111(iter_window) == True: # NEEDS CLEAN UP
                    beats11.append(iter_window)


            previous_points.append([time,volts])
            previous_points.pop(0)

        # STEP 1.5
        step15_name = 'step15{}'.format(self.step15_usage)
        beats15 = getattr(self,step15_name)(beats11)
        
        # STEP 2
        step2_name = 'step2{}'.format(self.step2_usage)
        beats2 = getattr(self,step2_name)(beats15)

        # STEP 3
        step3_name = 'step3{}'.format(self.step3_usage)
        beats3 = getattr(self,step3_name)(beats2)

        return beats3

    # UTILITY FUNCTIONS

    def regression(self, values, x):
        length = len(values)
        if length == 0:
            return 0
        Ey = 0    # Expectation of y
        Ex = 0    # Expectatio of x
        for element in values:
            timestamp, voltage = element
            timestamp = float(timestamp)
            Ey += int(voltage)
            Ex += int(timestamp)
        Ey = Ey/length
        Ex = Ex/length
        Sxy = 0 # sum of squares xy
        Sxx = 0 # sum of squares x
        for element in values:
            timestamp, voltage = element
            timestamp = float(timestamp)
            Sxy += (timestamp - Ex)*(voltage - Ey)
            Sxx =+ (timestamp - Ex)**2
        if Sxx == 0:
            return 0
        B1 = Sxy/Sxx
        B0 = Ey - B1*Ex
        y = B1*x + B0
        return y

    # slope of line of best fit. volts per thousands of a second.
    def get_slope(self,values):
        length = len(values)
        if length == 0:
            return 0
        Ey = 0    # Expectation of y
        Ex = 0    # Expectatio of x
        for element in values:
            timestamp, voltage = element
            timestamp = float(timestamp)
            Ey += int(voltage)
            Ex += int(timestamp)
        Ey = Ey/length
        Ex = Ex/length
        Sxy = 0.0 # sum of squares xy
        Sxx = 0.0 # sum of squares x
        for element in values:
            timestamp, voltage = element
            timestamp = float(timestamp)
            Sxy += (timestamp - Ex)*(voltage - Ey)
            Sxx =+ (timestamp - Ex)**2
        if Sxx == 0:
            return 0
        B1 = Sxy/Sxx
        return B1

    def beat_avg_volt(self,beat):
        sum = 0
        for element in beat:
            sum =+ element[1]
        if len(beat) == 0:
            return 0
        else:
            avg = sum/len(beat)
            return avg

    def beat_avg_time(self,beat):
        sum = 0
        for element in beat:
            sum =+ element[0]
        if len(beat) == 0:
            return 0
        else:
            avg = sum/len(beat)
            return avg

    def beat_var(self,beat):
        avg = self.beat_avg_volt(beat)
        var = 0
        for element in beat:
            var += (avg - element[1])**2
        if len(beat) == 0:
            return 1000
        else:
            return var/len(beat)

    def LSS(self,beat):
        B1 = self.get_slope(beat)
        Ey = self.beat_avg_volt(beat)
        Ex = self.beat_avg_time(beat)
        B0 = Ey - B1*Ex
        LSS = 0
        for element in beat:
            predicted_volt = element[0]*B1 + B0
            actual_volt =element[1]
            LSS += (predicted_volt - actual_volt)**2
        return LSS

    def get_peaks(self):

        self.PEAK = self.peak_benchmark()
        self.EXTRAPOLATION = self.extrapolation_benchmark()

        was_beat = False  # this boolean was implemented to prevent double counting beats that occur over two timestamps.
        beats = [] # list that will contain all beats in the format [timestamp, volts]
        previous_points = [[0,0] for i in range(20)] # list of the last 10 data points (from oldest to newest). List is also in the format [timestamp,volts]

        for time,volts in sorted(self.data.iteritems()):
            is_beat = False
            time = int(time)

            if previous_points[0] <> [0,0]:

                if volts > self.PEAK:   # discards data that does not exceed peak benchmark

                    regression_data = []  # preparing regression
                    for point in previous_points:
                        if int(point[0]) > time-1000*self.REACH_BACK:
                            regression_data.append(point)
                    regression_volts = self.regression(regression_data,time)
                    if volts > regression_volts + self.EXTRAPOLATION: # discards data that does not exceed extrapolation benchmark
                        if was_beat == False:
                            beats.append([time,volts])
                        is_beat = True

            # setting up next key-value pair evaluation
            previous_points.append([time,volts])
            previous_points.pop(0)
            was_beat = is_beat
        return beats

    # FPR get_peaks method. will almost certainly  be discarded.
    PEAK =  191
    EXTRAPOLATION = 19
    REACH_BACK = 0.19



    def peak_benchmark(self):
        avg = self.avg_volt()
        # There are two options I'd like to test at this point. Comment out one or the other.
        # 1) PEAK = avg*a, where a is an element of [1.01,1.3)
        # a = 1.05
        # peak_benchmark = avg*a
        # 2) PEAK = avg + a where a is an element of [5,30]
        a = 5
        peak_benchmark = avg + a
        # In both cases I will need to derive an experiment that determines which method is the most accurate.
        return peak_benchmark

    def extrapolation_benchmark(self):
        avg = self.avg_volt()
        PEAK = self.peak_benchmark()
        a = 3 # subject to experiments
        extrapolation_benchmark = (PEAK - avg)*a
        return extrapolation_benchmark

        # STEPS OPTIONS

    # discard zeros in beat windows
    def step10(self,window, benchmark = 0):
        switch = True
        for element in window:
            if 0 in element:
                switch = False
        if switch:
            return True
        else:
            return False

    def step11(self,window,all_above):
        beat = True
        for pair in window:
            if pair[1] < all_above:
                beat = False
        if beat:
            return True
        else:
            return False

    def step12(self,window,avg_above):
        length = len(window)
        if length == 0:
            return False
        sum = 0
        for point in window:
            sum += point[1]
        avg = sum/float(length)
        if avg > avg_above:
            return True
        else:
            return False
    
    def step13(self,window,max_above):
        window.sort(key=lambda x: x[1],reverse = True)
        max = window[0][1]
        if max > max_above:
            window.sort(key = lambda x: x[0])
            return True
        else:
            return False

    def step14(self,window,min_above):
        window.sort(key=lambda x: x[1],reverse = False)
        min = window[0][1]
        if min > min_above:
            window.sort(key = lambda x: x[0])
            return True
        else:
            return False

    def step15(self,window,slope_below):
        slope = self.get_slope(window)
        if slope <= slope_below:
            return True
        else:
            return False

    # unnecessary
    def step16(self,window,slope_above):
        slope = self.get_slope(window)
        if abs(slope) > slope_above:
            return True
        else:
            return False

    def step17(self,window,var_below):
        var = self.beat_var(window)
        if var < var_below:
            return True
        else:
            return False

    # CLEAN-UP NEEDED
    def step111(self,window):
        stamp = [False, False, False, False, False, False, False, False] # CLEAN UP
        for method in self.step1_methods:
            state = method.call_method(self,window) 
            if method.usage == 0:
                stamp[method.step_index] = True
            elif method.usage == 1:
                stamp[method.step_index] = state
            elif method.usage == 2:
                if state == False:
                    stamp[method.step_index] = True
                
        if stamp == [True,True,True,True,True,True,True,True]:
            return True
        else:
            return False

    def step151(self,beats1):
        beats15 = []
        for beat in beats1:
            beat_duration = beat[-1][0] - beat[0][0]
            prev_beat_duration = beats1[-1][-1][0] - beats1[-1][0][0]
            if beats15 == []:
                beats15.append(beat)
            elif beat[0][0] > beats15[-1][-1][0]:
                beats15.append(beat)
            elif prev_beat_duration < beat_duration:
                beats15.pop()
                beats15.append(beat)
        return beats15

    def step152(self,beats1):
        beats15 = []
        for beat in beats1:
            if beats15 == []:
                beats15.append(beat)
            elif beat[0][0] > beats15[-1][-1][0]:
                beats15.append(beat)
            else:
                for element in beat:
                    if element not in beats15[-1]:
                        beats15[-1].append(element)
                beats15[-1].sort(key = lambda x: x[0])
        
        return beats15

    def step153(self,beats1):
        beats15 = []
        for beat in beats1:
            if beats15 == []:
                beats15.append(beat)
            elif beat[0][0] > beats15[-1][-1][0]:
                beats15.append(beat)
            else:
                beats15.pop()
                beats15.append(beat)
        return beats15

    def step154(self,beats1):
        beats15 = []
        for beat in beats1:
            if beats15 == []:
                beats15.append(beat)
            elif beat[0][0] > beats15[-1][-1][0]:
                beats15.append(beat)
        return beats15

    # ADD METHOD THAT MAKES SPACING AS EVEN AS POSSIBLE

    def step21(self,beats15):
        beats2 = []
        min_spacing = 1000*self.min_spacing
        for beat in beats15:
            if beats2 == []:
                beats2.append(beat)
            elif beat[0][0] < beats2[-1][-1][0] + min_spacing:
                beat.sort(key = lambda x: x[1], reverse = True)
                beat_max_volt = beat[0][1]
                beat.sort(key = lambda x: x[0], reverse = False)
                beats2[-1].sort(key = lambda x: x[1], reverse = True)
                prev_beat_max_volt =  beats2[-1][0][1]
                beats2[-1].sort(key = lambda x: x[0], reverse = False)
                if beat_max_volt > prev_beat_max_volt:
                    beats2.pop()
                    beats2.append(beat)
            else:
                beats2.append(beat)
        return beats2

    def step22(self,beats15):
        beats2 = []
        min_spacing = 1000*self.min_spacing
        for beat in beats15:
            if beats2 == []:
                beats2.append(beat)
            elif beat[0][0] < beats2[-1][-1][0] + min_spacing:
                beat.sort(key = lambda x: x[1], reverse = False)
                beat_min_volt = beat[0][1]
                beat.sort(key = lambda x: x[0], reverse = False)
                beats2[-1].sort(key = lambda x: x[1], reverse = False)
                prev_beat_min_volt =  beats2[-1][0][1]
                beats2[-1].sort(key = lambda x: x[0], reverse = False)
                if beat_min_volt < prev_beat_min_volt:
                    beats2.pop()
                    beats2.append(beat)
            else:
                beats2.append(beat)
        return beats2

    def step23(self,beats15):
        beats2 = []
        min_spacing = 1000*self.min_spacing
        for beat in beats15:
            if beats2 == []:
                beats2.append(beat)
            elif beat[0][0] < beats2[-1][-1][0] + min_spacing:
                beat_avg = self.beat_avg_volt(beat)
                prev_beat_avg = self.beat_avg_volt(beats2[-1])
                if beat_avg > prev_beat_avg:
                    beats2.pop()
                    beats2.append(beat)
            else:
                beats2.append(beat)
        return beats2

    def step24(self,beats15):
        beats2 = []
        min_spacing = 1000*self.min_spacing
        for beat in beats15:
            if beats2 == []:
                beats2.append(beat)
            elif beat[0][0] < beats2[-1][-1][0] + min_spacing:
                beat_var = self.beat_var(beat)
                prev_beat_var = self.beat_var(beats2[-1])
                if beat_var < prev_beat_var:
                    beats2.pop()
                    beats2.append(beat)
            else:
                beats2.append(beat)
        return beats2

    def step25(self,beats15):
        beats2 = []
        min_spacing = 1000*self.min_spacing
        for beat in beats15:
            if beats2 == []:
                beats2.append(beat)
            elif beat[0][0] < beats2[-1][-1][0] + min_spacing:
                beat_LSS = self.LSS(beat)
                prev_beat_LSS = self.LSS(beats2[-1])
                if beat_LSS > prev_beat_LSS:
                    beats2.pop()
                    beats2.append(beat)
            else:
                beats2.append(beat)
        return beats2

    def step26(self,beats15):
        beats2 = []
        min_spacing = 1000*self.min_spacing
        for beat in beats15:
            if beats2 == []:
                beats2.append(beat)
            elif beat[0][0] < beats2[-1][-1][0] + min_spacing:
                beat_duration = beat[-1][0] - beat[0][0]
                prev_beat_duration = beats15[-1][-1][0] - beats15[-1][0][0]
                if beat_duration > prev_beat_duration:
                    beats2.pop()
                    beats2.append(beat)
            else:
                beats2.append(beat)
        return beats2

    def step31(self,beats2):
        beats3 = []
        for beat in beats2:
            beat.sort()
            beats3.append(beat[-1])
        return beats3

    def step32(self,beats2):
        beats3 = []
        for beat in beats2:
            beat.sort()
            beats3.append(beat[0])
        return beats3

    def step33(self,beats2):
        beats3 = []
        for beat in beats2:
            beat.sort()
            length = len(beat)
            index = int(length/2)
            beats3.append(beat[index])
        return beats3

    def step34(self,beats2):
        beats3 = []
        for beat in beats2:
            beats3.append(beat[0])
        return beats3

    def step35(self,beats2):
        beats3 = []
        for beat in beats2:
            beats3.append(beat[-1])
        return beats3