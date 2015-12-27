class BPMmethod(object):
    # benchmark RECEIVE WELL NEED
    # usage RECEIVE WELL NEED
    # name NEED

    # step NO NEED
    # beats LATER
    # description NO NEED

    def __init__(self,step,step_index,setting):
        name = 'step' + '%d' %step_index
        if step == 1:
            self.usage = setting.step1_usage[step_index]
        # NEED SETTING a and b and then change avg_benchmark to take less args

    def avg_benchmark(self,avg,a,b):
        benchmark = a*avg + b
        return benchmark

    # MAKE FUNCTION HERE THAT CALLS THE RESPECTIVE METHOD USING getattr

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
    # methods := list containing information about which methods were used in deriving the window
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
            self.avg = 195
        else:
            self.avg_volt = float(sum)/count
        ##################### maybe make into funciton later
        self.methods = self.initialize_method_objects(setting)

    # DEFINE FUNCTION TO get METHOD USAGE EASILY

    def initialize_method_objects(self,setting):
        methods = []
        for i in range(0,8):
            methods.append([])
            methods[i] = BPMmethod(1,i,setting)
        return methods

    # BPM

    def get_bpm(self):
        # peaks = self.get_peaks()
        peaks,text_back = self.get_beats()
        if type(peaks) is str:
            return 0, text_back
        keys = [int(key) for (key, volts) in peaks]
        if not keys:
            return 0, text_back
        if len(peaks) - 1 == 0:
            return 0, text_back
        avg = (max(keys) - min(keys)) / (len(peaks)-1)
        if avg == 0:
            return 0, text_back
        Expected_BPM = 60.0 * 1000.0 / avg
        return Expected_BPM, text_back

    # STEPS OPTIONS

    # discard zeros in beat windows
    def step10(self,window):
        switch = True
        for element in window:
            if 0 in element:
                switch = False
        
        if switch:
            return window
        else:
            return 0

    def step11(self,window,all_above):
        beat = True
        for pair in window:
            if pair[1] < all_above:
                beat = False
        if beat:
            return window
        else:
            return 0

    def step12(self,window,avg_above):
        length = len(window)
        if length == 0:
            return 0
        sum = 0
        for point in window:
            sum += point[1]
        avg = sum/float(length)
        if avg > avg_above:
            return window
        else:
            return 0
    
    def step13(self,window,max_above):
        window.sort(key=lambda x: x[1],reverse = True)
        max = window[0][1]
        if max > max_above:
            window.sort(key = lambda x: x[0])
            return window
        else:
            return 0

    def step14(self,window,min_above):
        window.sort(key=lambda x: x[1],reverse = False)
        min = window[0][1]
        if min > min_above:
            window.sort(key = lambda x: x[0])
            return window
        else:
            return 0

    def step15(self,window,slope_below):
        slope = self.get_slope(window)
        if abs(slope) <= slope_below:
            return window
        else:
            return 0

    def step16(self,window,slope_above):
        slope = self.get_slope(window)
        if abs(slope) > slope_above:
            return window
        else:
            return 0

    def step17(self,window,var_below):
        var = self.beat_var(window)
        if var < var_below:
            return window
        else:
            return 0


    def step111(self,power_set,initial_methods):
        methods = []
        initial_beats1 = power_set
        beats1 = []
        for method in initial_methods:
            if method[0] <> 0:
                methods.append(method)
        if methods == []:
            return "ERROR", "PLEASE ENTER VALID COMBINATION"
        for beat in initial_beats1:
            append = True
            for method in methods:
                if method[0] == 1:
                    if beat not in method[1]:
                        append = False
                if method[0] == 2:
                    if beat in method[1]:
                        append = False
            if append == True:
                beats1.append(beat)
        return beats1
    
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

    def step154(self,beats1):
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

    def step155(self,beats1):
        beats15 = []
        for beat in beats1:
            if beats15 == []:
                beats15.append(beat)
            elif beat[0][0] > beats15[-1][-1][0]:
                beats15.append(beat)
        return beats15

    def step21(self,beats15,min_spacing):
        beats2 = []
        min_spacing = 1000*min_spacing
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

    def step22(self,beats15,min_spacing):
        beats2 = []
        min_spacing = 1000*min_spacing
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

    def step23(self,beats15,min_spacing):
        beats2 = []
        min_spacing = 1000*min_spacing
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

    def step24(self,beats15,min_spacing):
        beats2 = []
        min_spacing = 1000*min_spacing
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

    def step25(self,beats15,min_spacing):
        beats2 = []
        min_spacing = 1000*min_spacing
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

    def step26(self,beats15,min_spacing):
        beats2 = []
        min_spacing = 1000*min_spacing
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



    def get_beats(self):
        # INCOMPLETE - step 0 - moves through data 50 datapoints at a time and discards parts with crazy variances.
        # step 1 - moves through data window by window and selects potential beats. returns list of windows that are/contain a beat
        # step 1.1 - combination of methods from 1
        # step 1.5 - moves through beat windows from step 1 and merges or chooses onw window if windows overlap
        # step 2 - goes through beats and eliminates if beats that are less than min_spacing apart
        # step 3 - selects one datapoint from each beat window

        self.iter_window_len = 0.1
        avg = self.avg_volt
                
        all_above = self.avg_benchmark(avg,1,2)
        avg_above = self.avg_benchmark(avg,1,5)
        max_above = self.avg_benchmark(avg,1,10)
        min_above = self.avg_benchmark(avg,1,2)
        var_below = self.avg_benchmark(avg,0.25,0)
        slope_below = self.avg_benchmark(avg,-0.0125,0)
        slope_above = self.avg_benchmark(avg,0.05,0)
        min_spacing = 0.33 # will be feeling changes,
        
        previous_points = [[0,0] for i in range(20)] # list of the last 20 data points (from oldest to newest). Data points are in the format [timestamp,volts]        
        beats1 = [[],[],[],[],[],[],[],[]]
        power_set = []

        for time,volts in sorted(self.data.iteritems()):

            time = int(time)
            
            window = []
            for point in previous_points:
                if int(point[0]) > time-1000*self.iter_window_len:
                    window.append(point)

            windows = [[],[],[],[],[],[],[],[]]

            if window <> []:

                # CHOOSE 1 - step 1 or alter the arguments for step111 below.
                window_0 = self.step10(window)                    # removes windows containing zeros
                window_1 = self.step11(window,all_above)   # all values in window must be above all_above
                window_2 = self.step12(window,avg_above)   # avg of window must be above avg_above
                window_3 = self.step13(window,max_above)   # max of winodw must be above max_above (can be changed to max below)
                window_4 = self.step14(window,min_above)   # min of window must be above min_above (can be changed to min below)
                # window_5 = getattr(self,'step15')(window,slope_below)
                # window_6 = getattr(self,'step16')(window,slope_above) WORKS
                window_5 = self.step15(window,slope_below) # fit regression to window. slop must be below slope_below
                window_6 = self.step16(window,slope_above) # fit regression to window. slop must be above slope_above                 
                window_7 = self.step17(window,var_below)   # variance below given value
                windows = [window_0, window_1,window_2,window_3,window_4,window_5,window_6,window_7]
                power_set.append(window)

            for indx,pass_window in enumerate(windows):
                if pass_window <> 0 and pass_window <> []:
                    beats1[indx].append(pass_window)

            previous_points.append([time,volts])
            previous_points.pop(0)

        total = len(power_set)
        BS = len(beats1[0])
        if total <> 0:
            per_BS = 1 -  BS/float(total)
            text_back = '{:.1%}'.format(per_BS)
        else:
            text_back = 'empty'

        # 0 => method doesn't matter
        # 1 => window must be selected by this method
        # 2 => window must NOT be selected by this method
        methods = [[1,beats1[0]],[0,beats1[1]],[0,beats1[2]],[0,beats1[3]],[0,beats1[4]],[2,beats1[5]],[2,beats1[6]],[0,beats1[7]]] # 5 and 6 2
        beats11 = self.step111(power_set,methods)

        # CHOOSE 1 - step 1.5
        # beats15 = self.step151(beats1) # keeps beat with longer duration
        beats15 = self.step152(beats11) # sticks together beats
        # beats15 = self.step153(beats1) # no function here
        # beats15 = self.step154(beats11)   # keeps last beat
        # beats15 = self.step155(beats1) # keeps first beat

        # CHOOSE 1 - step 2
        # beats2 = self.step21(beats15,min_spacing)  # keeps higher or lower max voltage
        # beats2 = self.step22(beats15,min_spacing)  # keeps higher or lower min voltage
        # beats2 = self.step23(beats15,min_spacing)  # keeps higher or lower avg voltage
        # beats2 = self.step24(beats15,min_spacing)  # keeps lower variance
        beats2 = self.step25(beats15,min_spacing)  # keeps higher sum of squares
        # beats2 = self.step26(beats15,min_spacing)  # keeps higher or lower duration

        # CHOOSE 1 - step 3
        # beats3 = self.step31(beats2)  # takes max voltage
        # beats3 = self.step32(beats2)  # takes min voltage
        beats3 = self.step33(beats2)  # takes median voltage
        # beats3 = self.step34(beats2)  # takes first point
        # beats3 = self.step35(beats2)    # takes last point

        return beats3, text_back

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