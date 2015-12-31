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
    # step1_methods := list of BPMmethod objects for step 1
    # empty := no data points in dictionary
    # avg_volt := average voltage in window
    # min_volt := minimum voltage in window
    # max_volt := maximum voltage in window
    # error_warning := if true, there are some indescreptancies and most likely an error.
    # error_locations := list of locations that may contain errors, should error warning be true
    # iter_window_length := lenght of the moving window inside the previously mentioned window. Unit = seconds
    # stepi_usage := for i element of {15,2,3} which method will be used for step i.
    # nnz_ier_windows := number of iter_windows that do not contain any zero volt tuples
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
        self.density = self.get_density() # empty will be set to True if self.length == 0 or self.size == 0.
        self.max_volt = max(self.data.itervalues())
        self.min_volt = min(self.data.itervalues())
        self.avg_volt,self.avg_time = self.get_avg(self.data)
        self.var_volt,dummy1,dummy2 = self.SyySxySxx(self.data)
        self.at_risk = self.at_risk()
        self.step1_methods = self.initialize_step1_method_objects(setting,self.avg_volt)
        self.step15_usage = setting.step15_usage
        self.step2_usage = setting.step2_usage
        self.step3_usage = setting.step3_usage
        self.nnz_iter_windows = 0
        self.bad_data_factor = 'not assigned yet'

    # DEFINE FUNCTION TO get METHOD USAGE in compact form - LATER, when doing tests

    def initialize_step1_method_objects(self,setting,avg):
        step1_methods = []
        for i in range(0,8):
            step1_methods.append([])
            step1_methods[i] = BPMmethod(1,i,setting,avg)
        return step1_methods
    
    # BPM
    def get_bpm(self):
        self.get_beats()
        if len(self.beats) - 1 <= 0:
            return 0
        if self.nnz_iter_windows > 0 and self.size > 0:
            self.bad_data_factor = self.nnz_iter_windows/float(self.size)
        else:
            self.bad_data_factor = 1
            self.empty = True
        avg = self.bad_data_factor*(max(self.beats) - min(self.beats)) / (len(self.beats)-1)
        if avg == 0:
            return 0
        Expected_BPM = 60.0 * 1000.0 / avg
        return Expected_BPM

    def get_beats(self):
        # INCOMPLETE - step 0 - some sort of 'bad data' detection
        # step 1 - moves through data iter_window by iter_window and selects potential beats. returns dictionaries of iter_windows that are/contain a beat.
        # step 1.5 - moves through beat iter_windows from step 1 and combines them or chooses one iter_window if the iter_windows overlap
        # step 2 - goes through beats and eliminates if beats that are less than self.min_spacing apart
        # step 3 - selects one datapoint from each beat window

        # STEP 1
        beats11 = self.step1()
        print len(beats11)

        if beats11 == []:
            self.beats = []
            return []

        # STEP 1.5   
        beats15 = self.step150(beats11)
        
        # STEP 2
        beats2 = self.step2(beats15)

        # STEP 3
        step3_name = 'step3{}'.format(self.step3_usage)
        beats3 = getattr(self,step3_name)(beats2)
        
        self.beats = beats3


    # STEP methods

    def step1(self):
        previous_points = [[0,0] for i in range(20)] # COULD PROBABLY BE REDUCED. list of the last 20 data points (from oldest to newest). Data points are in the format [timestamp,volts]
        beats11 = []

        for time,voltsignal in sorted(self.data.iteritems()):

            time = int(time)
            
            iter_window = {}
            for point in previous_points:
                timestamp = int(point[0])
                volts = point[1]
                if timestamp > time-1000*self.iter_window_len:
                    iter_window[timestamp] = volts

            if iter_window <> {}:

                if self.step111(iter_window) == True: # NEEDS CLEAN UP
                    beats11.append(iter_window)


            previous_points.append([time,voltsignal])
            previous_points.pop(0)

        if self.nnz_iter_windows == 0:
            self.at_risk = True
        
        return beats11

    # discard zeros in beat windows
    def step10(self,iter_window, benchmark = 0):
        for time,volts in iter_window.items():
            if volts == 0:
                return False
        self.nnz_iter_windows += 1
        return True

    def step11(self,iter_window,all_above):
        for time,volts in iter_window.items():
            if volts <= all_above:
                return False
        return True

    def step12(self,iter_window,avg_above):
        # CLEAN UP
        avg, dummy = self.get_avg(iter_window)
        if avg > avg_above:
            return True
        else:
            return False
    
    # CLEAN UP
    def step13(self,iter_window,max_above):
        max_volts = max(iter_window)
        if max_volts > max_above:
            return True
        else:
            return False

    # CLEAN UP
    def step14(self,iter_window,min_above):
        min_volts = min(iter_window)
        if min_volts > min_above:
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

    # CLEAN UP dummies
    def step17(self,iter_window,var_below):
        var,dummy1,dummy2 = self.SyySxySxx(iter_window)
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
            elif method.usage == 3:
                if state == True:
                    return True
                else:
                    return False
            elif method.usage == 4:
                if state == False:
                    return True
                else:
                    return False
        if stamp == [True,True,True,True,True,True,True,True]:
            return True
        else:
            return False

    def step150(self,beats11):
        step15_name = 'step15{}'.format(self.step15_usage)
        beats15 = [beats11[0]]
        for beat in beats11[1:-1]:
            previous_beat = beats15[-1]
            combine, replace_previous = getattr(self,step15_name)(beat,previous_beat)
            if min(beat) > max(previous_beat):
                beats15.append(beat)
            elif replace_previous:
                beats15.pop()
                beats15.append(beat)
            elif combine:
                for time,volts in beat.items():
                    beats15[-1][time] = volts
        return beats15
    
    # longer beat duration
    def step151(self,beat,previous_beat):
        combine = False
        replace_previous = False
        beat_duration = max(beat) - min(beat)
        prev_beat_duration = beats11[-1] - beats1[-1][0][0]
        if prev_beat_duration < beat_duration:
            replace_previous = True
        return combine, replace_previous

    # combine
    def step152(self,beat = [],previous_beat = []):
        combine = True
        replace_previous = False
        return combine, replace_previous

    # always replace previous
    def step153(self,beat = [], previous_beat = []):
        combine = False
        replace_previous = True
        return combine, replace_previous
    
    # always keep previous
    def step154(self,beat = [], previous_beat = []):
        combine = False
        replace_previous = False
        return combine, replace_previous

    # ADD METHOD THAT MAKES SPACING AS EVEN AS POSSIBLE
    def step2(self,beats15):
        step2_name = 'step2{}'.format(self.step2_usage)
        beats2 = [beats15[0]]
        min_spacing = 1000*self.min_spacing
        for beat in beats15:
            previous_beat = beats2[-1]
            if min(beat) > max(previous_beat) + min_spacing:
                beats2.append(beat)
            else: # created else to save time
                replace_previous = getattr(self,step2_name)(beat,previous_beat)
                if replace_previous:
                    beats2.pop()
                    beats2.append(beat)
        return beats2

        # keep larger max voltage
    def step21(self,beat, prev_beat):
        replace_previous = False
        beat_max_volt = beat[max(beat, key=beat.get)]
        prev_beat_max_volt = prev_beat[max(prev_beat, key=prev_beat.get)]
        if beat_max_volt > prev_beat_max_volt:
            replace_previous = True
        return replace_previous

        # keep larger min voltage
    def step22(self,beat,prev_beat):
        replace_previous = False
        beat_min_volt = beat[min(beat, key=beat.get)]
        prev_beat_max_volt = prev_beat[min(prev_beat, key=prev_beat.get)]
        if beat_min_volt > prev_beat_min_volt:
            replace_previous = True
        return replace_previous

        # keep larger avg voltage
    def step23(self,beat,prev_beat):
        replace_previous = False
        beat_avg_volt, dummy1 = self.get_avg(beat)
        prev_beat_avg_volt, dummy2 = self.get_avg(prev_beat)
        if beat_avg_volt > prev_beat_avg_volt:
            replace_previous = True
        return replace_previous

        # keep larger variance COULD USE SMALLER VARIANCE FUNCTION TOO
    def step24(self,beat,prev_beat):
        beat_var,dummy1,dummy2 = self.SyySxySxx(beat)
        prev_beat_var,dummy1,dummy2 = self.SyySxySxx(prev_beat)
        if beat_var > prev_beat_var:
            replace_previous = True
        return replace_previous

        # keep largest LSS COULD USE SMALLEST LSS FUNCTION TOO
    def step25(self,beat, prev_beat):
        replace_previous = False
        beat_LSS = self.LSS(beat)
        prev_beat_LSS = self.LSS(prev_beat)
        if beat_LSS > prev_beat_LSS:
            replace_previous = True
        return replace_previous

        # keep largest beat duration
    def step26(self,beat, prev_beat):
        replace_previous = False
        beat_duration = max(beat) - min(beat)
        prev_beat_duration = max(prev_beat) - min(prev_beat)
        if beat_duration > prev_beat_duration:
            replace_previous = True
        return replace_previous

    # take max volts
    def step31(self,beats2):
        beats3 = {}
        for beat in beats2:
            max_volt_key = max(beat, key=beat.get)
            beats3[max_volt_key] = beat[max_volt_key]
        return beats3

    # take min volts
    def step32(self,beats2):
        beats3 = {}
        for beat in beats2:
            min_volt_key = min(beat, key=beat.get)
            beats3[min_volt_key] = beat[min_volt_key]
        return beats3

    # median
    def step33(self,beats2):
        beats3 = {}
        for beat in beats2:
            length = len(beat)
            index = int(length/2)
            count = 0
            for time,volts in sorted(beat.iteritems()):
                if count == index:
                    beats3[time] = volts
                    break
                count += 1
        return beats3

        # first tuple
    def step34(self,beats2):
        beats3 = {}
        for beat in beats2:
            min_key = min(beat)
            beats2[min_key] = beat[min_key]
            return beats3

        # last tuple
    def step35(self,beats2):
        beats3 = {}
        for beat in beats2:
            max_key = max(beat)
            beats3[max_key] = beat[max_key]
        return beats3

    # UTILITY FUNCTIONS
    def get_avg(self,sample):
        volt_sum = 0
        time_sum = 0
        count = 0
        for time,volts in sample.items():
            volt_sum += volts
            time_sum += time
            count += 1
        if count == 0:
            return 0,0
        else:
            avg_volt = float(volt_sum)/count
            avg_time = float(time_sum)/count
            return avg_volt, avg_time

    def SyySxySxx(self,sample):
        Ey, Ex = self.get_avg(sample)
        Syy = 0.0 # variance
        Sxy = 0.0 # sum of squares xy
        Sxx = 0.0 # sum of squares x
        for time, volts in sample.items():
            Syy += (volts - Ey)**2
            Sxy += (time - Ex)*(volts - Ey)
            Sxx += (time - Ex)**2
        return Syy,Sxy,Sxx

    def at_risk(self):
        if self.var_volt**(1/2) > 0.25*self.avg_volt:
            return True
        else:
            return False

        # slope of line of best fit. volts per thousands of a second.
    def get_slope(self,sample):
        Syy,Sxy,Sxx = self.SyySxySxx(sample)
        if Sxx == 0:
            return 0
        B1 = Sxy/Sxx
        return B1

    def LSS(self,beat):
        B1 = self.get_slope(beat)
        Ey,Ex = self.get_avg(beat)
        B0 = Ey - B1*Ex
        LSS = 0
        for time,volts in beat.items():
            predicted_volt = time*B1 + B0
            actual_volt = volts
            LSS += (predicted_volt - actual_volt)**2
        return LSS

    def get_density(self):
        if self.length == 0 or self.size == 0:
            self.empty = True
            self.density = 0
        else:
            self.density = self.size/(float(self.length)/1000)