# Developer documentation of the project _Shriveling World_
* Access the [full list of modules and functions](doc) of the project _Shriveling world_
* Data structures of the project are defined as [interfaces](https://www.typescriptlang.org/docs/handbook/interfaces.html) in the [module _project_](/modules/_definitions_project_.html)
* The main variables of the project are defined in the [module _configuration_](/modules/_common_configuration_.html)
* The main functions of the project are in the [class _merger_](/classes/_bigboard_merger_.merger.html)
* GUI is dealt with in the [module _guiDAT_](/modules/_bigboard_guidat_.html)
* The main parameter of the model is [alpha](/interfaces/_definitions_project_.icomplexalphaitem.html#conealpha) determining the slope of [cones](/interfaces/_definitions_project_.icomplexalphacone.html) based on the ratio between [road] speed and the maximum available speed at the period considered

## From a transport network between cities to a set of three-dimensional graphical objects
The model is based on a transport network linking cities (see [conceptual framework for geographical time-space representation](https://timespace.hypotheses.org/184)). More explanations about the [terminology choices can be found here](https://timespace.hypotheses.org/177).
Mathematical and graphical objects:
* the graph representing this transport network is made of [cities](/interfaces/_definitions_project_.icity.html) and [edges](/interfaces/_definitions_project_.iedge.html) ([interfaces _IEdges_](/interfaces/_definitions_project_.iedge.html)). The graph can be accessed at the city level in the form of a subgraph centred on a given city: [interface _ICityGraph_](/interfaces/_definitions_project_.icitygraph.html)*.
* The graph is explored for implementing the parameters of [curves](/interfaces/_definitions_project_.ilookupcurvesfromcity.html) and [cones] in the [function _networkFromCities_](/modules/_bigboard_merger_.html#networkfromcities), one of the most important of the project
* [edges](/interfaces/_definitions_project_.iedge.html) are the vertices of the graph; edges are only mathematical entities, not to be confounded with their graphical expression as [curves](/interfaces/_definitions_project_.ilookupcurvesfromcity.html)
* [curves](/interfaces/_definitions_project_.ilookupcurvesfromcity.html) are the graphical objects representing the graph [edges](/interfaces/_definitions_project_.iedge.html); in the model, curves may be represented as (depending on the value of the user defined parameter '_pointsPerCurve_', accessed from the menu _Curves_, _nb of points_)
  * straight lines, ('_pointsPerCurve_'=1)
  * broken lines as two segments with one intermediate point, ('_pointsPerCurve_'=2)
  * geodesics or
  * three dimensional curves approximating a Bézier curve ('_pointsPerCurve_'>2, value higher than 50 recommended)
     * in the case of the air mode, a rule based on a threshold on the length of links applies, see [function _getModelledSpeed_](/modules/_bigboard_merger_.html#getmodelledspeed)
* [cones](/interfaces/_definitions_project_.icomplexalphacone.html) are generated from an angle [alpha](/interfaces/_definitions_project_.icomplexalphaitem.html#conealpha) computed by comparing the (terrestrial) speed on the cone with the speed of the fastest transport mode considered in the given period
  * [cones](/interfaces/_definitions_project_.icomplexalphacone.html) may have a constant and uniform slope based on a unique [alpha](/interfaces/_definitions_project_.icomplexalphaitem.html#conealpha)
  * [cones](/interfaces/_definitions_project_.icomplexalphacone.html) may have a different slope
  * (not yet  implemented) [cones](/interfaces/_definitions_project_.icomplexalphacone.html) may have different slopes (complex alphas) if different terrestrial transport networks are considered

## Data model
The [data model](https://timespace.hypotheses.org/91):
![data model](assets/modeles8.svg)