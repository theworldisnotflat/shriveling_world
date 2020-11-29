# Developper documentation of the project _Shriveling World_
* Access the [full list of modules and functions](doc) of the project _Shriveling world_
* Data structures of the project are defined as [interfaces](https://www.typescriptlang.org/docs/handbook/interfaces.html) in the [module _project_](/modules/_definitions_project_.html)
* The main function of the project is the [class _merger_](/classes/_bigboard_merger_.merger.html)
* GUI is dealt with in the [module _guiDAT_](/modules/_bigboard_guidat_.html)
* The main parameter of the model is [alpha](/interfaces/_definitions_project_.icomplexalphaitem.html#conealpha) determining the slope of [cones] based on the ratio between [road] speed and the maximum available speed at the period considered

## From a transport network between cities to a set of three-dimensional graphical objects
The model is based on a transport network linking cities (see [conceptual framework for geographical time-space representation](https://timespace.hypotheses.org/184)). More explanations about the [terminology choices can be found here](https://timespace.hypotheses.org/177).
Mathematical and graphical objects:
* the graph representing this transport network is made of [cities](/interfaces/_definitions_project_.icity.html) and [edges](/interfaces/_definitions_project_.iedge.html) ([interfaces _IEdges_](/interfaces/_definitions_project_.iedge.html)). The graph can be accessed at the city level in the form of a subgraph centred on a given city: [interface _ICityGraph_](/interfaces/_definitions_project_.icitygraph.html)
* [edges](/interfaces/_definitions_project_.iedge.html) are the vertices of the graph; edges are only mathematical entities, not to be confounded with their graphical expression as [curves](/interfaces/_definitions_project_.ilookupcurvesfromcity.html)
* [curves](/interfaces/_definitions_project_.ilookupcurvesfromcity.html) are the graphical objects representing the graph [edges](/interfaces/_definitions_project_.iedge.html); in the model, curves may be represented as (depending on the value of the user defined parameter '_pointsPerCurve_')
  * straigt lines, ('_pointsPerCurve_'=0)
  * broken lines, ('_pointsPerCurve_'=1)
  * geodesics or
  * three dimensional curves ('_pointsPerCurve_'>2)
* [cones] are generated from an angle [alpha](/interfaces/_definitions_project_.icomplexalphaitem.html#conealpha) computed by comparing the (terrestrial) speed on the cone with the speed of the fastest tansport mode considered in the given period
  * [cones] may have a constant and uniform slope based on a unique [alpha](/interfaces/_definitions_project_.icomplexalphaitem.html#conealpha)
  * [cones] may have a different slope
  * (not yet  implemented) [cones] may have different slopes (complex alphas) if different terrestrial transport networks are considered

## Data model
The [data model](https://timespace.hypotheses.org/91):
![data model](assets/modeles8.svg)