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

Web Interface
-------------

The website provides an overview of the data being collected by the UberVest,
with a live ECG trace and the last aquired temperature being shown to a signed
in user.

Data displayed on the website is pulled from the UberVest API, with live data
being pushed out by Firebase[^L1].

Data Processing and Analysis
--------

Data processing and analysis consists largely of the generation of a live beats
per minute (BPM) feed. Some research and experimentation on future applications of a 
respiratory sensor has also been completed.

The live BPM feed takes a moving window (between 4 and 15 seconds) as argument and 
returns a BPM value. ECG data is filtered through multiple methods to identify beats
and then extrapolated to 60 seconds. 

With regard to the potential future applications of the respiratory sensor, a method
has been explored and tested to rank patients by their respiratory fitness and an 
experiment has been conducted to determine how good an indicator mean respiratory flow 
is of a young healthy individual's fitness.

Applications in Health and Sport
--------

Both in health and sport, the use of data analytics is becoming more and more popular. 
One significant example of this is Calico, a Google-backed biotechnology company that 
has recently gained access to Ancestry.com's genetic database with the intention of using
genetic and family tree related data to improve the human lifespan. Another is the usage 
of GPS tracking devices in Rugby. We believe that the UberVest is could add to the 
possiblities of data analytics by providing data. We have also selected some applications 
that the UberVest could work towards:  
1. Heart attack / stroke detection  
2. Analysis of continuous temperature monitoring  
3. Automatic detection of severe exacterbations in COPD patients (through continuous respiratory monitoring)  
4. Respiratory and general fitness testing (for personal use and to identify at risk individuals)  

Links
-----

[^L1]: http://firebase.io
