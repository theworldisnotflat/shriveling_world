# Instructions for the creation of a dataset

## Data model

![data model](assets/data_model_v11.svg 'data model')

## A system of six files

According to the data model, _Shriveling world_ datasets are composed of six files:

1. [cities file](#cities-file)
2. [population file](#population-file)
3. [transport network file](#transport-network-file)
4. [transport modes file](#transport-modes-file)
5. [transport mode speed file](#transport-mode-speed-file)
6. [GEOJSON file](#geojson-file) with the contour of continents or countries

The files describe a **graph** modelling a transport network between cities with **speed** as a key parameter. The content of the files is [described below](#content-of-files-columns).

## A differential model

The _Shriveling world_ model is by design **differential**, id est, it compares the basic terrestrial road speed with the fastest available transport speed. This comparison of speed computes a ratio that will determine the slope of cones. Addressing the issue of the historical contraction of time-space due to the improvement of transport means, the _Shriveling world_ model allows for considering different periods in time, years, different moments when the ratio is computed. The ratio is fixed for a given year.

## Historical time span

The dataset will generate a _historical time span_ during which, for each year, a graphical representation may be built. This _historical time span_ considers the dates attached to the modes and network links but also the coexistence of road and other transport modes. This coexistence of transport modes is necessary to generate the cones slope, [as seen earlier](#a-differential-model). Hence the _historical time span_ is based on data provided about the year of opening and sometimes ending (e.g. supersonic aircraft) of the transport services, an on the period where **road speed and another faster transport mode speed** are known.
The _historical time span_ needs to fill in the variable _firstYear_ and the variable _lastYear_

-   _firstYear_ will be the earliest year when the model can be computed
-   _lastYear_ will be the latest year when the model can be computed

There are two sources to determine this _historical time span_:
Source file | Columns | Rationale
----------|----------|----
_transport_network.csv_ |_eYearBegin\_\_eYearEnd_| to allow for considering the growth of a transport network of a given speed, over time, e.g. the morphogenesis of the high-speed rail network
_transport_mode_speed.csv_|_year_|speed data is central in the model; speed data over years found in this file should be consistent with the other year sources

## Algorithm for determining the historical time span

### Step #1 Computing basic variables at transport mode level

At code run, a series of time variables attached to the transport mode are computed. At one point the following variables are known for each transport mode:

| Variable name | formula           | Comments                                                                                                                                                             |
| ------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| _minEYear_    | min(_eYearBegin_) | the earliest date present in the network file for the corresponding transport mode; may be empty, in such case the relevant info comes from _transport_network_ file |
| _maxEYear_    | max(_eYearEnd_)   | Usually empty (exception is Concorde that stopped operations)                                                                                                        |
| _minSYear_    | min(_year_)       | The earliest year in the _transport_mode_speed_ file                                                                                                                 |
| _maxSYear_    | max(_year_)       | The latest year in the _transport_mode_speed_ file                                                                                                                   |

### Step #2 Computing _firstYear_ at transport mode level

A valid period for the model has an operating network and speed data. The period of operation of the network can be determined at edge level in the _transport_network_, while speed data comes as a table of*year_and_speed*. Network data should be consistent with the [other data sources for the historical time span](#historical-time-span), and hence be considered when computing*yearBegin<sub>road</sub>*. The equation becomes:

_yearBegin<sub>road</sub>_ = max(_minSYear<sub>road</sub>_, _minEYear<sub>road</sub>_)

In case one or several _minEYear<sub>road</sub>_ values are empty, the variable _minEYear_ should have no influence on forming _firstYear_.

The computation for _road_ described in steps #1 and #2 should be repeated for each transport mode accordingly.

### Step #3 Computing _lastYear_ at transport mode level

The formula is:

_yearEnd<sub>road</sub>_ = min( _maxSYear<sub>road</sub>_, _maxEYear<sub>road</sub>_)

The computation for _road_ described in steps #1 and #3 should be repeated for each transport mode accordingly.

### Step #4 Compute the _Historical time span_

Due to the [differential nature of the model](#a-differential-model), _firstYear_ should be indicated by the earliest year of operation among all the non road transport modes. In a typical, well formed dataset, one or several transport modes faster than road are described, typically expressway, high-speed rail or airlines. In this case the earliest date when the model can be computed is when one of these faster modes starts operations, providing _yearBegin<sub>road</sub>_ is equal or earlier.

_firstYear_ = min(_yearBegin<sub>Transp1</sub>_, _yearBegin<sub>Transp2</sub>_, ...)

Usually -- exception made of historical past datasets and prospective datasets -- _lastYear_ should be the current year. In order to care for these two cases, we add the rule that if _yearEnd<sub>road</sub>_ is empty, it should be populated with _currentYear_ and otherwise untouched.

1. _lastYear_ = max(_yearEnd<sub>Transp1</sub>_, _yearEnd<sub>Transp2</sub>_, ...)
2. if _yearEnd<sub>road</sub>_ is empty, then _yearEnd<sub>road</sub>_ = _currentYear_,

These formulas apply in the -- well formed dataset -- case where years for road are consistent with other modes years data, and hence: _yearBegin<sub>road</sub>_ <= _firstYear_ AND _yearEnd<sub>road</sub>_ >= _lastYear_

<!-- Algorithm for determining the variables _firstYear_ and  _lastYear_:

Source file | Starting year for each mode | Ending year for each mode
----------|----------|----------
_transport mode speed.csv_ | _yearBeginRoadMode_ = min(_year<sub>road</sub>_), _yearBeginFasterTransp1Mode_ = min(_year<sub>Transp1</sub>_), _yearBeginFasterTransp2Mode_ = min(_year<sub>Transp2</sub>_), etc.|  _yearEndRoadMode_= max(_year<sub>road</sub>_), _yearEndFasterTransp1Mode_ = max(_year<sub>Transp1</sub>_), _yearEndFasterTransp2Mode_ = max(_year<sub>Transp2</sub>_), etc.
_transport network.csv_ | _yearBeginRoadNetwork_ = min(_yearBegin<sub>road</sub>_), _yearBeginFasterTransp1Network_, _yearBeginFasterTransp2Network_, etc.| _yearEndRoadNetwork_ = max(_yearEnd<sub>road</sub>_), _yearEndFasterTransp1Network_, _yearEndFasterTransp2Network_, etc.

_yearBeginRoad_ = min (_yearBeginRoadMode_, _yearBeginRoadNetwork_)
_yearBeginFasterTransp1_ = min (_yearBeginFasterTransp1Mode_, _yearBeginFasterTransp1Network_)
_yearBeginFasterTransp2_ = min (_yearBeginFasterTransp2Mode_, _yearBeginFasterTransp2Network_)
etc.

_yearEndRoad_ = max (_yearEndRoadMode_, _yearEndRoadNetwork_)

_firstYear_ = max((_yearBeginRoad_), min(_yearBeginFasterTransp1_, _yearBeginFasterTransp2_, etc.))
_lastYear_ = min((_yearEndRoad_), max(_yearEndFasterTransp1_, _yearEndFasterTransp2_, etc.))

-->

In addition, the transport related period should also be coherent with the dates of the city population data.

## Mandatory elements in the dataset

General **common sense** instructions:

-   Files are in CSV format produced with default export options from LibreOffice Calc.
-   The [six files](#a-system-of-six-files) must all be present in the dataset
-   As shown in the [figure of the data model](#data-model) each file has optional and mandatory columns
    -   mandatory columns must be populated completely, with no missing data
    -   optional columns may be left empty or may be completely or partially populated
-   Column names in files **MUST** be rigorously respected
-   Id fields must be carefully populated because they connect files to each other:
    -   _cityCode_ from the city file is linked to _iOri_ and _iDes_ in the network file
    -   _transportModeCode_ code from the transport network file is linked to _code_ in the transport mode code file, and _transportModeCode_ in the transport mode speed file
-   text type: _countryName_, _urbanAgglomeration_, _name_ (of transport mode)
-   numeric type: _countryCode_, _cityCode_, _latitude_, _longitude_, etc

Specific **critical** instructions:

-   The file [_transport mode_](#transport-mode-file) **MUST** contain a mode named _Road_ that will define the slope of cones; cones is the geographic surface and the _Road_ speed is attached to this surface
-   For the same reason the file [_transport mode speed_](#transport-mode-speed-file) **MUST** contain speed information for the mode _road_
-   The mode _road_ **MUST** be _terrestrial_ (property _terrestrial_ = 1)
-   The model being by design [differential](#a-differential-model), at least one other transport mode with a speed **MUST** be described (in both files [_transport mode_](#transport-mode-file) and [_transport mode speed_](#transport-mode-speed-file))

## Content of files columns

-   The column order in files is not necessarily the same as proposed here.
-   Column names **MUST** be rigorously respected since they are used to identify files at run time.

### Cities file

| Column name    | Type   | Mandatory | Comments                                                                                                                                                                                                                                            |
| -------------- | ------ | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| _cityCode_     | number | yes       | city unique id                                                                                                                                                                                                                                      |
| _cityName_     | string | yes       | agglomeration (city) name                                                                                                                                                                                                                           |
| _countryCode_  | number | yes       | numeric code of country where city belongs                                                                                                                                                                                                          |
| _countryName_  | string | yes       | country name where city belongs                                                                                                                                                                                                                     |
| _latitude_     | number | yes       | numeric with comma, e.g. 35.55597                                                                                                                                                                                                                   |
| _longitude_    | number | yes       | numeric with comma                                                                                                                                                                                                                                  |
| _radius_       | number | no        | cone radius for the case of islands located close to a coastal area devoid of cities, to avoid island cone overlapping in the coastal area, e.g. Canary Islands close to Maroc                                                                      |
| _yearMotorway_ | number | no        | in order to affect the slope of this cone (city) from this year, in a variant of the model that changes local cone slope according the connectivity to a faster network (even if not all surrounding space is experiencing this speed of transport) |
| _yearHST_      | number | no        | same as previous, but here concerning High Speed Rail                                                                                                                                                                                               |

### Population file

| Column name  | Type   | Mandatory | Comments                                                                                                      |
| ------------ | ------ | --------- | ------------------------------------------------------------------------------------------------------------- |
| _cityCode_   | number | yes       | id of city                                                                                                    |
| _year_       | number | yes       | year of census period                                                                                         |
| _population_ | number | yes       | in thousands inhabitants, at the agglomeration level recommended, e.g. as in UN World Urban Prospect database |

### Transport network file

The _transport network file_ describes the edges of the graph between the cities as nodes. A line in the _transport network file_ describes the existence of an infrastructure or a bi-directional transport service between two cities. See here for [a justification of the terminology choices](https://timespace.hypotheses.org/177).
Column name | Type | Mandatory | Comments
----------|----------|-------------|-------------
_cityCodeOri_|number|yes|id of origin city; direction (ori-des or des-ori) has no meaning in the model. A line in the network file marks the existence of an infrastructure or a bi-directional transport service between two cities.
_cityCodeDes_|number|yes|id of destination city
_transportModeCode_|number|yes|id of the transport mode
_eYearBegin_|number|no|year of opening of the edge, infrastructure or service, e.g. High Speed Rail in 1964 between Tokyo and Osaka; if _eYearBegin_ is not populated( even only one single edge) , the period _historical time span_ will be determined from the variable _year_ in the _transport speed_ file
_eYearEnd_|number|no|may be used for a service no longer operated, e.g. supersonic commercial aircraft Concorde between Paris and New-York started in 1977 and stopped operating in 2004; if _eYearEnd_ not populated (even only one single edge), the period _historical time span_ will be determined from the variable _year_ in the _transport speed_ file

For the sake of readability this file usually contains two optional columns of _oriName_ and _desName_.

### Transport mode file

| Column name | Type   | Mandatory | Comments                        |
| ----------- | ------ | --------- | ------------------------------- |
| _name_      | string | yes       | mode name                       |
| _code_      | number | yes       | unique id of the transport mode |

### Transport mode speed file

A given transport mode may experience an increase of speed over time, e.g. the five acceleration phases of China classical railways (non High Speed Rail) between 1997 and 2004
Column name | Type | Mandatory | Comments
----------|----------|-------------|-------------
_year_|number|yes|referring to a date when speed changed
_transportModeCode_|number|yes|id of transport mode
_speedKPH_|number|yes|commercial average speed on the transport network

### GEOJSON file

The GEOJSON file is needed to cut the cones at the limits of the shores or at the limits of a country or region.

**CAUTION**: for an unknown reason the GEOJSON file may crash the app; as a workaround use the provided world geojson file.
