Outline
____________
1. What is it?
    * What does it do
    * How could a client use it
    * Medican usage
2. Components of the system
3. Team Members and Responsibilities
4. Hardware
5. Mobile app
6. API
7. Processing
8. Web interface
9. Conclusion
    * Future work
    * improvements
    * Health applications

Introduction
------------

Team Members and Responsibilities
------------

* [Filip Frahm](filip.html) - Data Analysis
* [Hayden Ball](hayden.html) - Hardware and Website
* [Jonathan Redmond](jonathan.html) - Android App
* [Milan Pavlik](milan.html) - API
* [Roy Hotrabhavnon](roy.html) - Hardware

Hardware
--------

The UberVest hardware consists of two parts: a compression shirt containing
electrodes and sensors, and a beltpack that contains signal processing circuits
and the nRF51-DK board.

The final design included electrodes and amplification / filtering circuitry to
aquire an electrocardiogram (ECG) of the wearer of the shirt, and a sensor to
allow monitoring of the wearer's temperature.

The design made use of the analogue to digital converter and Bluetooth Low
Energy tranciever available in the nRF51822 microprocessor, which is included
on the nRF51-DK. This allows us to read values from the analogue sensors and
transmit the data on to the Android app.
