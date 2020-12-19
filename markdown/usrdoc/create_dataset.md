# Instructions for the creation of a dataset

## Data model

![data model](assets/modeles8.svg 'data model')

## A system of five files

According to the data model, _Shriveling world_ datasets are composed of five files:
1. cities
2. population
3. transport network
4. transport modes
5. transport mode speed

The files describe a __graph__ modelling a transport network between cities with __speed__ as a key parameter. The content of the files is [described below](#content-of-files-columns).

## A differential model

The _Shriveling world_ model is by design __differential__, id est, it compares the basic terrestrial road speed with the fastest available transport speed. This comparison of speed computes a ratio that will determine the slope of cones. Addressing the issue of the historical contraction of time-space due to the improvement of transport means, the  _Shriveling world_ model allows for considering different periods in time, years, different moments when the ratio is computed. The ratio is fixed for a given year.

## Historical time span

The dataset will generate a _historical time span_ during which, for each year, a graphical representation may be built. This _historical time span_ considers the dates attached to the modes and network links but also the coexistence of road and other transport modes. This coexistence of transport modes is necessary to generate the cones slope, [as seen earlier](#a-differential-model). Hence the _historical time span_ is based on data provided about the year of opening and sometimes ending (e.g. supersonic aircraft) of the transport services, an on the period where __road speed and another faster transport mode speed__ are known.
The _historical time span_ needs to fill in the variable _yearBegin_ and the variable _yearEnd_
* _yearBegin_ will be the earliest year when the model can be computed
* _yearEnd_ will be the latest year when the model can be computed

There are two sources to determine this _historical time span_:
Source | Rationale
----------|----------
_transport mode speed.csv_ | to allow for comparing modes in general, e.g. road vs rail in the long term
_transport network.csv_ | to allow for considering the growth of a transport network of a given speed, over time, e.g. the morphogenesis of the high-speed rail network

## Algorithm for determining the historical time span

Algorithm for determining the variables _yearBegin_ and  _yearEnd_:

Source file | Starting year for each mode | Ending year for each mode
----------|----------|----------
_transport mode speed.csv_ | _yearBeginRoadMode_ = min(_year<sub>road</sub>_), _yearBeginFasterTransp1Mode_ = min(_year<sub>Transp1</sub>_), _yearBeginFasterTransp2Mode_ = min(_year<sub>Transp2</sub>_), etc.|  _yearEndRoadMode_= max(_year<sub>road</sub>_), _yearEndFasterTransp1Mode_ = max(_year<sub>Transp1</sub>_), _yearEndFasterTransp2Mode_ = max(_year<sub>Transp2</sub>_), etc.
_transport network.csv_ | _yearBeginRoadNetwork_ = min(_yearBegin<sub>road</sub>_), _yearBeginFasterTransp1Network_, _yearBeginFasterTransp2Network_, etc.| _yearEndRoadNetwork_ = max(_yearEnd<sub>road</sub>_), _yearEndFasterTransp1Network_, _yearEndFasterTransp2Network_, etc.

_yearBeginRoad_ = min (_yearBeginRoadMode_, _yearBeginRoadNetwork_)
_yearBeginFasterTransp1_ = min (_yearBeginFasterTransp1Mode_, _yearBeginFasterTransp1Network_)
_yearBeginFasterTransp2_ = min (_yearBeginFasterTransp2Mode_, _yearBeginFasterTransp2Network_)
etc.

_yearEndRoad_ = max (_yearEndRoadMode_, _yearEndRoadNetwork_)

_yearBegin_ = max((_yearBeginRoad_), min(_yearBeginFasterTransp1_, _yearBeginFasterTransp2_, etc.))
_yearEnd_ = min((_yearEndRoad_), max(_yearEndFasterTransp1_, _yearEndFasterTransp2_, etc.))

The transport related period should also be coherent with the dates of the city population data.

## Mandatory elements in the dataset

General __common sense__ instructions

* The [five files](#a-system-of-five-files) must all be present in the dataset
* As shown in the [figure of the data model](#data-model) each file has optional and mandatory columns
  * mandatory columns must be populated completely, with no missing data
  * optional columns may be left empty or may be completely or partially populated
* Column names in files __MUST__ be rigorously respected
* Id fields must be carefully populated because they connect files to each other:
  * _cityCode_ from the city file is linked to _iOri_ and _iDes_ in the network file
  * _transportModeCode_ code from the transport network file is linked to _code_ in the transport mode code file, and _transportModeCode_ in the transport mode speed file
* text type: _countryName_, _urbanAgglomeration_, _name_ (of transport mode)
* numeric type: _countryCode_, _cityCode_, _latitude_, _longitude_, etc

Specific __critical__ instructions:
* The file [_transport mode_](#transport-mode-file) __MUST__ contain a mode named _Road_ that will define the slope of cones; cones is the geographic surface and the _Road_ speed is attached to this surface
* For the same reason the file [_transport mode speed_](#transport-mode-speed-file) __MUST__ contain speed information for the mode _road_
* The model being by design [differential](#a-differential-model), at least one other transport mode with a speed __MUST__ be described (in both files  [_transport mode_](#transport-mode-file) and [_transport mode speed_](#transport-mode-speed-file))


## Content of files columns

* (__to be checked__)The column order in files is not necessarily the same as proposed here.

* Files are in CSV format produced with default export options from LibreOffice Calc.
* Column names __MUST__ be rigorously respected

### Cities file

Column name | Type | Mandatory | Comments
----------|----------|-------------|-------------
_countryCode_ |number|yes|numeric code of country where city belongs
_countryName_|string|yes|country name where city belongs
_cityCode_|number|yes|city unique id
_urbanAgglomeration_|string|yes|agglomeration (city) name
_latitude_|number|yes|numeric with comma, e.g. 35.55597
_longitude_|number|yes|numeric with comma
_radius_|number|no|cone radius for the case of islands located close to a coastal area devoid of cities, to avoid island cone overlapping in the coastal area, e.g. Canary Islands close to Maroc
_yearMotorway_|number|no|in order to affect the slope of this cone (city) from this year, in a variant of the model that changes local cone slope according the connectivity to a faster network (even if not all surrounding space is experiencing this speed of transport)
_yearHST_|number|no|same as previous, but here concerning High Speed Rail

### Population file
Column name | Type | Mandatory | Comments
----------|----------|-------------|-------------
_cityCode_|number|yes|id of city
_year_|number|yes|year of census period
_population_|number|yes|in thousands inhabitants, at the agglomeration level recommended, e.g. as in UN World Urban Prospect database

### Transport network file
The _transport network file_ describes the edges of the graph between the cities as nodes. See her for [a justification of the terminology choices](https://timespace.hypotheses.org/177).
Column name | Type | Mandatory | Comments
----------|----------|-------------|-------------
_yearBegin_|number|no|year of opening of the edge, infrastructure or service; if not populated, period _historical time span_ will be determined from _transport mode code_ file data
_yearEnd_|number|no|may be used for a service no longer operated, e.g. supersonic commercial aircraft Concorde
_cityCodeOri_|number|yes|id of origin city; direction (ori-des or des-ori) has no meaning in the model
_cityCodeDes_|number|yes|id of destination city
_transportMode_|number|yes|id of the transport mode

For the sake of readability this file usually contains two optional columns of _oriName_ and _desName_.

### Transport mode file
Column name | Type | Mandatory | Comments
----------|----------|-------------|-------------
_name_|string|yes|mode name
_code_|number|yes|unique id of the transport mode
_yearBegin_|number|yes|year of opening of the first infrastructure or service of the mode, e.g. High Speed Rail in 1964 between Tokyo and Osaka
_yearEnd_|number|no|may be used for a service no longer operated, e.g. supersonic commercial aircraft Concorde between Paris and New-York started in 1977 and stopped operating in 2004


### Transport mode speed file
A given transport mode may experience an increase of speed, e.g. the five acceleration phases of China classical railways (non High Speed Rail) between 1997 and 2004
Column name | Type | Mandatory | Comments
----------|----------|-------------|-------------
_year_|number|yes|referring to a date when speed changed
_transportModeCode_|number|yes|id of transport mode
_speedKPH_|number|yes|commercial average speed on the transport network