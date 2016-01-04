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
