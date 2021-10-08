## Creating a dataset from scratch

### Example of a French _département_

#### Download GIS file
#### Generate centroids of communes
In (QGIS)[https://qgis.org]:
* In the menu _Vector_, then _Geometry tools_, select _Centroids_

#### Create graph of the network
* Create a table for the network:
   * _Layer_, _Create layer_
   * With _Geometry type_ as _LineString_
   * Optionally you may add a _comment_ field to indicate the name of the network entity (e.g. expressway code)
* In QGIS display only the commune centroids
* Select network layer, make it editable
* Click the button _Add line feature_
* to end this _line_, right click anywhere
#### Complete network info with node ids
* rename network table column _trip_id_ into _polyline_id_
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

#### Export centroids to csv
