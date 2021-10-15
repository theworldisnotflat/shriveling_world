## Creating a dataset from scratch

### Example of a French _département_

#### Download GIS file

For the Communes layer download [GEOFLA Communes](https://geo.data.gouv.fr/en/datasets/cac9f2c0de2d3a0209af2080854b6f6a7ee3d9f4)

#### Generate centroids of communes

In [QGIS](https://qgis.org):

* In the menu _Vector_, then _Geometry tools_, select _Centroids_ of the Communes layer

#### Create the [graph](https://en.wikipedia.org/wiki/Graph_theory) of the network

* Create a table for the network:
  * _Layer_, _Create layer_
  * With _Geometry type_ as _LineString_
  * Optionally you may add a _comment_ field to indicate the name of the network entity (e.g. expressway code)
* In QGIS display only the commune centroids
* Select network layer, make it editable
* Click the button _Add line feature_
* to end this _line_, right click anywhere

#### Generate info of the nodes of the network/graph

* Rename network table column _trip_id_ into _polyline_id_; in case it doesn't exist create a column named _polyline_id_ with  _@row_number_ as content:
  * Open _Attribute table_
  * _Toggle editing mode_
  * _Open field calculator_
  * _Create new field_ named _polyline_id_
  * Populate it with the _Variable_ called _row_number_
* Execute _Explode lines_
* In the new table _exploded_ create a new column called _edge_id_
  * Open _Attribute table_
  * _Toggle editing mode_
  * _Open field calculator_
  * _Create new field_ named _edge_id_
  * Populate it with the _Variable_ called _row_number_
* From the _Processing toolbox_, run the algorithm _Extract specific vertices_
  * with option _Vertex indices_ to value _0_ to generate a new layer of starting points, to be renamed _start_
  * with option _Vertex indices_ to value _1_ to generate a new layer of ending points, to be renamed _end_
* For the _start_ layer:
  * Run an _Intersection_ with _start_ and the _communes_ layer where the id of the points resides
  * Remove unnecessary fields
  * Rename the city id field into _cityCodeOri_ and its name as _cityNameOri_
* For the _end_ layer:
  * Run an _Intersection_ with _end_ and the _communes_ layer where the id of the points resides
  * Remove unnecessary fields
  * Rename the city id field into _cityCodeDes_ and its name as _cityNameDes_

#### Generate graph file

* From the generated _end_ layer:
  * In _Layer properties_ select _Joins_
  * Click the green plus sign _Add Vector join_
  * Join with the _end_ layer with cities info
  * For _Join field_ choose _edge_id_
  * As _Target field_ choose also _edge_id_

This table can then be copy-pasted into a CSV editor (e.g LibreOffice Calc)

