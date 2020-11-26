#Instructions for the creation of a dataset

##Data model

![data model](https://github.com/theworldisnotflat/shriveling_world/blob/master/model/modeles7.png)
According to the data model, _Shriveling world_ datasets are composed of five files:
1. cities
2. populations
3. transport modes
4. transport mode speed
5. network

The files describe a __graph__ modelling a transport network between cities with __speed__ as a key parameter.

##A differential model
The _Shriveling world_ model is by design __differential__, id est, it compares  the basic terrestrial road speed with the fastest available transport speed. This comparison of speed computes a ratio that will determine the slope of cones. Addressing the issue of the historical contraction of time-space due to the improvement of transport means, the  _Shriveling world_ model allows for considering different periods in time, years, different moments when the ratio is computed. The ratio is fixed for a given year.

##Historical time span
The dataset will generate a _historical time span_ during which, for each year, a graphical representation may be built. This _historical time span_ considers the dates attached to the modes and network links but also the coexistece of road and other transport modes. This coexistence of transport modes is necessary to generate the cones slope, [as seen earlier](#a-differential-model). Hence the _historical time span_ is based on data provided about the year of opening and sometimes ending (e.g. supersonic aircraft) of the transport services, an on the period where __road speed and another faster transport mode speed__ are known.
The _historical time span_ needs to fill in the variable _yearBegin_ and the variable _yearEnd_
* _yearBegin_ will be the earliest year when the model can be computed
* _yearEnd_ will be the latest year when the model can be computed

There are two sources to determine this _historical time span_:
Source | Rationale
----------|----------
_transport mode speed.csv_ | to allow for comparing modes in general, e.g. road vs rail in the long term
_transport network.csv_ | to allow for considering the growth of a transport network of a given speed, over time, e.g. the morphogenesis of the high-speed rail network

Algorithm for determining the variables _yearBegin_ and  _yearEnd_:

Source file | Starting year for each mode | Ending year for each mode
----------|----------|----------
_transport mode speed.csv_ | _yearBeginRoadMode_ = min(_year_(road)), _yearBeginFasterTransp1Mode_ = min(_year_(Transp1)), _yearBeginFasterTransp2Mode_ = min(_year_(Transp2)), etc.|  _yearEndRoadMode_= max(_year_(road)), _yearEndFasterTransp1Mode_ = max(_year_(Transp1)), _yearEndFasterTransp2Mode_ = max(_year_(Transp2)), etc.
_transport network.csv_ | _yearBeginRoadNetwork_, _yearBeginFasterTransp1Network_, _yearBeginFasterTransp2Network_, etc.| _yearEndRoadNetwork_, _yearEndFasterTransp1Network_, _yearEndFasterTransp2Network_, etc.

_yearBeginRoad_ = min (_yearBeginRoadMode_, _yearBeginRoadNetwork_)
_yearBeginFasterTransp1_ = min (_yearBeginFasterTransp1Mode_, _yearBeginFasterTransp1Network_)
_yearBeginFasterTransp2_ = min (_yearBeginFasterTransp2Mode_, _yearBeginFasterTransp2Network_)
etc.

_yearEndRoad_ = max (_yearEndRoadMode_, _yearEndRoadNetwork_)

_yearBegin_ = max((_yearBeginRoad_), min(_yearBeginFasterTransp1_, _yearBeginFasterTransp2_, etc.))
_yearEnd_ = min((_yearEndRoad_), max(_yearEndFasterTransp1_, _yearEndFasterTransp2_, etc.))