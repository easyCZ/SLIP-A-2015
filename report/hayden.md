Hayden Ball
===========

My contribution to the project was focused on two areas: the project website and
working with Roy to design and build the sensor hardware.

Hardware
--------

The hardware element of the project consisted of designing sensors for the
health vest, installing them into the vest, and transferring data from the
sensors to the Android application which could then upload the data for further
processing and display.

The final design includes electrodes and analogue filtering circuitry to acquire
an electrocardiogram (ECG) of the wearer, and a sensor to allow monitoring of
the wearer's temperature.

The electrodes and temperature sensor are connected to a "belt pack" which
contained the ECG filtering circuit, a simple potential divider for the
temperature sensor, and the nRF51 Development Kit (nRF51-DK). The NRF51-DK
provides an easy interface to the nRF51822 microprocessor, which includes an
analogue to digital converter (ADC) and Bluetooth Low Energy transceiver.

### ECG Circuit

One of the more technically challenging aspects of the project was designing
and building a circuit for obtaining a clean ECG trace.

An ECG shows the change in electrical potential between two points on the body
caused by the depolarization and repolarisation of different heart muscles.

At first, this may appear to be a trivial problem to solve - we simply need to
build an amplifier to amplify the difference in potential between two electrodes
attached to the body. Unfortunately, there are also a number of challenges to
overcome.

The differential signal we are trying to obtain is in the order of 500μV,
meaning we must obtain a gain of around 30dB to obtain a usable signal. This,
as is to be expected with high gain amplifiers, introduces a large amount of
noise into the signal. Thankfully - for the basic QRS sequence we are interested
in - the signal frequency content is around 10Hz, allowing us to filter a large
amount of the noise introduced.

As the output of the circuit was to be sampled at around 25Hz, we also took care
to ensure that we had sufficient filtering beyond 12.5Hz to avoid aliasing.

Roy was responsible for the initial circuit design (based on Jason Nguyen's
circuit [^1]), which I then built and tested. Following initial testing, Roy and
myself worked together to tackle the challenges described above.

#### Circuit refinement

The initial circuit provided a recognizable ECG trace, shown below.

![ECG trace without filter](waveforms/ECG without filter.png)

Although recognizable, the trace obtained contains a large amount of noise as
the first iteration of the circuit made little attempt to filter noise.

Using a Picoscope, we were able to identify the frequency of the noise
introduced:

![ECG frequency without filter](waveforms/ecg without filter frequency.png)

We identified the troublesome frequencies as being 50Hz and its harmonics
(100Hz, 200Hz, 400Hz, etc), which was likely introduced by our power supply.
However, as these are beyond our desired signal frequency of 10Hz, we were able
to simply add a 2nd order low pass filter to remove the noise.

The addition of the low pass filter had a significant impact, resulting in the
following output:

![ECG trace with filter](waveforms/ECG output waveform.png)
![ECG frequency with filter](waveforms/Spectrum with 2nd order filter_1.png)

The frequency trace clearly shows our new 40dB/decade roll-off above the
frequencies of interest, effectively removing the majority of noise present.
This also had the advantage of meeting our requirement of reducing frequencies
beyond 12.5Hz, preventing any aliasing issues.

#### Circuit Evaluation
discuss off the shelf alternatives

### Vest Electrodes
Up to this point, we have been testing using "Skintact" electrodes - an "off the
shelf" product that is designed to achieve good electrical contact between the
electrode and the skin. Unfortunately, the electrodes are single use, and are
also uncomfortable (particularly when removing them!).

As part of the project we wanted to integrate the ECG electrodes into the vest,
removing the need for single-use electrodes, and providing more comfort to the
wearer. We also spent time investigating different placements of the electrodes,
with the aim of reducing movement artifacts (caused by electrical activity in
other muscles) and obtaining an acceptable input signal.

#### Electrode Placement

The generally accepted electrode placement for a 3 lead ECG has the -ve
electrode on the right side of the chest, just below the shoulder bone, the
ground electrode is placed on the left side of the chest, opposite the -ve
electrode, and the +ve electrode is placed in the 5th or 6th intercostal space
on the left side of the chest. Unfortunately, very large movement artifacts are
easily introduced, causing a complete loss of our desired signal.

<table>
  <tr>
    <td>
      <img src="electrode_placement_trials/placement6.jpg">
    </td>
    <td>
      <img src="electrode_placement_trials/placement6_waveform_normal.png">
    </td>
    <td>
      <img src="electrode_placement_trials/placement6_waveform_movement.png">
    </td>
  </tr>
  <tr>
    <td></td>

    <td>
      With little movement, a very clear trace is obtained (although in the
      image the +ve and -ve electrodes have been incorrectly connected,
      resulting in an inverted trace).
    </td>

    <td>
      However, with movement, the trace becomes unintelligible.
    </td>
  </tr>
</table>

After a little research, I came across an alternative electrode configuration
which is recommended for use in exercise physiology (which involves large
amounts of movement during tests). The configuration, introduced in "Exercise
Physiology: Nutrition, Energy, and Human Performance" [^2], has the ground
electrode on the sternum, with the -ve and +ve electrodes in the 5th intercostal
space on each side of the chest.

![From "Exercise Physiology: Nutrition, Energy, and Human Performance"](pictures/bipolar configuration.png)

This placement produces a satisfactory trace, pictured below:

<table>
  <tr>
    <td>
      <img src="electrode_placement_trials/placement1.jpg">
    </td>
    <td>
      <img src="electrode_placement_trials/placement1_waveform.png">
    </td>
  </tr>
</table>

#### Electrode design

#### Evaluation
requires gel

### Thermometer Circuit
#### Evaluation
further calibration required

### mbed Programming
#### Evaluation
discuss sampling


### Packaging
#### Evaluation
large beltpack

Website
-------

### Backbone
### Firebase
### Graphing

### Footnotes and References

[^1]:
  http://www.eng.utah.edu/~jnguyen/ecg/long_story_3.html

[^2]:
  Exercise Physiology: Nutrition, Energy, and Human Performance
  By William D. McArdle, Frank I. Katch, Victor L. Katch
  PP327

A Study on the Optimal Positions of ECG Electrodes
in a Garment for the Design of ECG-Monitoring
Clothing for Male
Hakyung Cho1 & Joo Hyeon Lee 2
http://download.springer.com.ezproxy.is.ed.ac.uk/static/pdf/307/art%253A10.1007%252Fs10916-015-0279-2.pdf?originUrl=http%3A%2F%2Flink.springer.com%2Farticle%2F10.1007%2Fs10916-015-0279-2&token2=exp=1451992300~acl=%2Fstatic%2Fpdf%2F307%2Fart%25253A10.1007%25252Fs10916-015-0279-2.pdf%3ForiginUrl%3Dhttp%253A%252F%252Flink.springer.com%252Farticle%252F10.1007%252Fs10916-015-0279-2*~hmac=625b5b688ef63cdf41e20c474298e158c0320bba8cd689cd2816679e657533f2
