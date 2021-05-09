## Creating a dataset from scratch

### Example of a French _département_

#### Download GIS file
#### Generate centroids of communes
#### Create _latitude_ and _longitude_ fields for the centroids
In QGIS
* Create two numerical fields named _latitude_ and _longitude_
* The fields should have at least 3 + 3 precision depth
* Populate each field via the Field calculator with the formulas:
   * latitude: 'x(centroid($geometry))'
   * longitude: 'y(centroid($geometry))'

#### Rename key fields
As explained in the dataset files reference, you must rename the relevant following mandatory fields:
* cityCode
* cityName
#### Export centroids to csv