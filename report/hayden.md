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

[^1]

#### Circuit Evaluation
discuss filtering

### Vest Electrodes
#### Electrode Placement
abnormal
refer to:
  Exercise Physiology: Nutrition, Energy, and Human Performance
  By William D. McArdle, Frank I. Katch, Victor L. Katch
  PP327

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

[^1]: http://www.eng.utah.edu/~jnguyen/ecg/long_story_3.html

References:
A Study on the Optimal Positions of ECG Electrodes
in a Garment for the Design of ECG-Monitoring
Clothing for Male
Hakyung Cho1 & Joo Hyeon Lee 2
http://download.springer.com.ezproxy.is.ed.ac.uk/static/pdf/307/art%253A10.1007%252Fs10916-015-0279-2.pdf?originUrl=http%3A%2F%2Flink.springer.com%2Farticle%2F10.1007%2Fs10916-015-0279-2&token2=exp=1451992300~acl=%2Fstatic%2Fpdf%2F307%2Fart%25253A10.1007%25252Fs10916-015-0279-2.pdf%3ForiginUrl%3Dhttp%253A%252F%252Flink.springer.com%252Farticle%252F10.1007%252Fs10916-015-0279-2*~hmac=625b5b688ef63cdf41e20c474298e158c0320bba8cd689cd2816679e657533f2
