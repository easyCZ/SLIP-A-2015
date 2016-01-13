# Introduction
The purpose of the UberVest project is to design a wearable device - a vest - providing health monitoring functionality to the wearer. The primary aim of the vest is hearth rate monitoring and respiratory monitoring. Additionally, the project aims to deliver storage of sensory readings as well as analysis of the data in order to provide relevant and easy to use information for the wearer. Furthermore, sensory readings are communicated in real time with a monitoring application to allow real time feedback as well as monitoring.

In order to achieve the goal, the project is composed of various pieces of technology: wearable hardware, mobile application, data storage and data exposure service and a website with live monitoring.

In this report, I will focus on the design and implementation of the project architecture as well as the data storage and data exposure services which I have been involved in.

# Requirements
Firstly, on a high level, the requirements for the project consisted of finding a suitable infrastructure design to be able to send, process, store and expose sensory readings from the hardware component. The requirements for the project can be broken down into two categories: functional requirements and non-functional requirements.

## Functional Requirements
* The sensory readings from the hardware device should be stored
* The sensory readings from the hardware device should be uploaded in real time or as close to real time as possible
* The sensory readings should be available on all devices (mobile application, web) and should reflect realtime readings
* The readings should be analyzed and analyzed data exposed for retrieval

## Non-functional Requirements
* We should be able to access the data from anywhere on the internet, not just inside a private network
* In the development process, we should aim to keep the cost of running our services free

Secondly, further details of the requirements were discovered in the process of development and implementation and will be discussed in their respective relevant sections.

# Design
Taking the above requirements into consideration, a simple explanation of the required design would be to store, analyze and retrieve information in real time. Firstly, given the nature of the system, our primary focus was on supporting real time capabilities in our system. Secondly, our focus was on the ability to provision storage and computing capacity to analyze the data.

The design process was done in steps with review of each step against both the functional and non-functional requirements. I will outline the design process below.

## Understand the devices
Firstly, it is essential to understand what kind of devices will need to be able to connect and access the infrastructure. The figure below outlines the different devices required to interact with the infrastructure. There are two devices required to interact with the infrastructure, both with different application programming interface.

![Design Devices](./design_1.png)

### Device Requirements
Firstly, the mobile application requires to communicate with the hardware device in order to relay sensory readings to the infrastructure. The communication protocol between the smart phone and the wearable is over Bluetooth. The underlying application implementation is in Java.

Secondly, the web application uses HTML, CSS and Javascript and communicates through the HTTP protocol.

Therefore, a sensible communication protocol between the mobile application and the web application is HTTP, providing a standardized implementation and widespread adoption rate in the industry. Consequently, the infrastructure implementation is required to implement its interface to support HTTP.

## Storage
The nature of the sensory readings from the wearable is the driving factor for the required type of storage used. For a given type of sensor (hearth rate, respiratory), we are mainly interested in the time series produced, therefore, we are primarily interested in a pair of data <timestamp>:<value>. Consequently, due to no inherent relationship nature in our sensory data we decided to use a NoSQL database as a storage layer.

## Realtime Communication
Being an essential functional requirement of this project, the ability to effectively utilize real time updates is essential. Real time updates can be effectively implemented in the browser using web sockets while real time updated on the backend systems can be implemented using push notifications with new data inserted. Therefore, an ideal real time system used would be one supporting both websockets and some sort of a notification stream. We have decided to use FireBase [1] as the underlying storage layer. Firebase supports storage of non-relational data either as a key-value pairs in a given 'table' or as a list of values. Furthermore, FireBase provides a JavaScript implementation of a websocket client capable of listening to data changes in the storage layer itself as well as a notification stream. Threfore, FireBase satisfied both our needs for storage and real time communication capability. Furthermore, FireBase provided a free usage plan which suited our non-functional requirements of keeping the services free.

We have also evaluated other options for storage with real time communciation built into it. The table below outlines the aspects we considering during evaluation.

|Database|Pricing|Deployment Model|Ease of realtime updates|Perceived Ease of Use|
|---|---|---|---|---|
|FireBase [1]|Free|Hosted|Built-in|Easy|
|Redis [2]|Free|User managed|Additional library required|Difficult due to deployment management|
|RethinkDB [3]|Free|User managed|Built-in|Difficult due to deployment management|

Given that Firebase provided a hosted solution with built in support for realtime updates, it was decided to be the best choice for the project development model where we wanted to spend less time on infrastructure setup and more on development. Furthermore, FireBase API allows us to send data directly into FireBase from the mobile application without requiring to build an intermediate layer, removing complexity of the system.

## API
Having decided on the underlying storage model for the sensory data, we had a clearer picture of our requirements for the API, the main processing unit of the application. The API is responsible for retrieval of raw data from the FireBase storage layer and transforming the data - applying processing and analytics - in order to be able present the data in a sensible form to the users on the website.

Functionally, we require the API to be easy to use and sufficiently performant so that it would be able to keep up with the potential load from the users. Additionally, the API also needed to be responsible for managing different devices registered with the service as well as management of users and storage of historical data. 

As a direct requirement of the API, we introduce another storage layer, a relational PosgreSQL database in order to help us keep track of users and devices as well as processed data (historical) data. The decision for PosgreSQL came from the analysis that our user and device data had inherent relationships and therefore the usage of a relational database would help us better model the problem. PosgreSQL specifically was chosen for its long standing place in the industry providing a wealth of information online in case of problems.

For the API itself, we picked Python and the Django Framework for its simplicity of ORM integration with PosgreSQL. Additionally, Python is a language the whole team is familiar with as well as it allows us to iterate on a solution faster than a system written in Java or other compiled language would.


## The Infrastructure
Given the outline of the components above, the infrastructure looks as follows:

![Infrastructure](./2_api.png)

There are direct interactions between Django and Firebase in order to process the data which will be outlined in more detail further on. Django then further interacts with PosgreSQL in order to store processed data as well as to serve information about users and devices. Keeping the data stores separate helps maintain separation of concerns and decouples the individual systems from each other.

## Deployment
As part of our requirements to be able to access the data from anywhere on the internet, it is essential to be able to able to deploy the system effectively into the public domain. Evaluating free server hosting options available to, we have decided to go with hosting provided by OpenShift. We used the following table to evaluate the features of each system its suitability for our purposes.

|Provider|Number of Applications|Host inactive for portion of day|Applications available (Python, PosgreSQL)|
|---|---|---|---|---|
|OpenShift [4]|3|No|Both|
|Heroku [5]|1|Sleeps 6 hours in 24 hours|Both|
|Amazon Free Tier [6]|Any number of apps|750 hours uptime per month|Both|

Out of the options available, we feel that OpenShift provides the best features as well as constant uptime which is important for our application.


# Implementation

## Deployment setup
The application is configured to run on OpenShift. The platform allows us to run up to three applications. Our setup includes running the Django application, a PosgreSQL application and Jenkins [7] to handle continous deployment from our version control system (git).

When a new commit is made to the repository, Jenkins will be notified through a post commit hook and execute a deployment process. This deployment process involved a few steps:

1. Run application tests
2. Update database schema according to schema migrations
3. Undeploy existing application
4. Re-deploy the application

This workflow using a continous integration agent - Jenkins - greatly simplifies the development cycle. 

## API
The API is implemented according to REST [8] design prenciples. As outlined in a paper on REST design [9], REST improves client's ability to understand the data being requested and improves discoverability of resources in the system. In order to develop our REST API quickly, a Django REST Framework [10] is used as a module for Django. Furthermore, a user friendly documentation and exploration of the API is exposed on the API server allowing a user of the API to discover various endpoints of the API. An example of such browsable API is shown below. The browsable API can be accessed through [here](http://api-ubervest.rhcloud.com/).

![Devices API](./3_api_devices.png)
![Devices BPM API](./4_api_devices_bpm.png)

The API application itself is broken down into packages. The top level package of interest is the *devices* package which contains logic for storage and retrieval of devices stored on the system. It can be retrieved through */devices* or */devices/<device_id>* for a particular device. Each device also has BPM readings associated to with it which can be retrieved through */devices/<device_id>/bpm*.

Furthermore, the API also runs a second process responsible for listening to live ecg readings, processing them and analyzing the current value of beats per minute (Filip's work).

Finally, the processed data is being stored in the PosgreSQL database for future retrieval and analysis.

# Evaluation
In order to evaluate the performance of the API server, we can emulate a large number of users accessing the data in the API simultaneously. Using a general purpose load tester, we can execute the following `echo "GET http://api-ubervest.rhcloud.com/devices/" | vegeta attack -duration=5s  | tee results.bin | vegeta report -reporter=plot > plot.html` to obtain a graph of the latency over time over sustained load.

![Evaluation API](./5_eval_api.png)

From the graph we can observe that the current architecture of the API (with the free version of OpenShift) is not capable of scaling with the number of requests. This is an expected result as the service provided by the free tier of OpenShift delivers service in terms of best effort. Additionally, the API server is running as a singlar instance only and therefore an increased load will have direct impact on all requests being currently processed and increase the latency as visible in the graph above.






# Improvements


* [1] [FireBase](https://www.firebase.com/)
* [2] [Redis](http://redis.io/)
* [3] [RethinkDB](http://rethinkdb.com/)
* [4] [OpenShift](https://www.openshift.com/pricing/index.html)
* [5] [Heroku](https://www.heroku.com/)
* [6] [AWS Free Tier](http://aws.amazon.com/free/)
* [7] [Jenkins](https://jenkins-ci.org/)
* [8] [REST](http://www.restapitutorial.com/lessons/whatisrest.html)
* [9] [REST Architecture Style](https://www.ics.uci.edu/~fielding/pubs/dissertation/rest_arch_style.htm)
* [10] [Django REST Framework](http://www.django-rest-framework.org/)




