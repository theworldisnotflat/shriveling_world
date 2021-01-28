# Basic usage tutorial

## First steps

**Step #1**:The app runs in a browser from this address:

[Shriveling world](/app/)

**Step #2**: Once the app runs in the browser data is read by two alternative ways:

* Click on predefined dataset list on the left side of the browser window
* Introduce data in the app by drag & drop (see below)

_Attention: in any case data processing may take time, depending on the number of cities and the performance of your own machine, CPU and GPU. So once clicked on the list of predefined datasets or drag & drop files, you have to wait for a few seconds_

**Step #3**: enjoy! navigate around the three dimensional structure with mouse controls, define projection through interface, define desired control parameters through the interface on the right. Reload the page in the browser before changing dataset.

## Introducing data in the application by drag & drop

Drag & drop the following geojson and csv files found in the folder datasets in the web app:

-   cities.csv
-   population.csv
-   transport_mode_code.csv
-   transport_mode_speed.csv
-   transport_network.csv
-   110m_land_shrivel.geojson

## General parameters

Instructions for the application are provided in a lateral user interface.

Most commands can be accessed through the lateral UI:

-   __Year__: base year of the representation (value in the networks files) 'Generalities', 'year'


* __Cartographic projection__:
  * __Static__: change 'Generalities', 'projection', 'Initial projection' the variable _projectionInit_ : projection with values in in the following range :
    *   'none' for a three dimensional un-projected representation
    *   'equirectangular' or 1 for an equilateral flat representation
    *   'Mercator' or 2 for a 2-dimensional Mercator
  * __Dynamic__
    * Set the final projection: 'Generalities', 'projection', 'final projection'
    * 'transition': transition value between projectionBegin and projectionEnd. Value included in the range 0 to 100 included.

## Parameters of the geometry of the model

More detail about the three dimensional geometry of the model, [here](/marks/usrdoc/model_geometry).

- __Cones__:
  * __Color__: Menu 'Cones', 'cones color'
  * __Rendering quality__: 'coneStep' modifies the visual aspect of cones. The default value is 15 degrees, a facet = 15°, a recommended value is 5 or less. Lower values will generate higher quality graphics, at the cost of larger export files and resource consuming rendering
  * the __shape of cones__ has currently three available options:
     * in the default __based on road__ case, all cones are simple regular cones with a unique slope -- for a given year -- based on the road speed
     * in the __fast terrestrial transport mode__ case, cones all have a regular shape but may have different slopes; the slope of a cone is determined by the connection to a terrestrial transport mode faster than road. The mere connection of the city to the a high speed rail line network will alter the slope of its cone, expressing its access to fast speed. In this case the slope, i.e. the local time-space relative speed, is potentially wrong in many places, but we produce an image that highlights the connectivity of cities to hight speed terrestrial transport networks. In this case, we ignore the 'tunnel effect' of fast transport networks.
     * in the __complex cones__ case, cones are locally deformed based on existing incoming or departing edges of transport terrestrial transport modes faster than road, typically expressway or High-Speed Rail lines. In this case, as in the previous one, we ignore the 'tunnel effect' of fast transport networks.

* __Curves__:
  * __Color__ and __transparency__: curves may have a different color and transparency according to the transport mode they represent, chosen in 'Curves', 'terrestrial modes' and 'Aircraft'
  * __Straight lines__ or __curves__:  the parameter 'nb of points' will populate the variable  'nbPointsPerCurve=X where X is an integer between 1 and 199 included. This value determines the way curves are drawn:
    - The value **1** draws all straight lines
    - The value **2** draws a broken line, as two segments with an intermediate point; the line has the desired length
    - A value superior to __2__ will interpolate a Bézier curve of the desired length. This curve can be a geodesic in the non projected case, or can be a longer curve. Recommended value is superior to __50__ for a high quality graphic

## Navigation
* click + scroll
* alt scroll = rotation
* ctrl scroll = translation


## Exports

* The __three dimensional scene__ can be exported. Export to gltf (.obj) file format is available (red button in the bottom). In order to import in Blender the file produced from the app, see [Blender instructions](/marks/usrdoc/blender_instructions).

* A __travel times matrix__ in minutes between the cities of the input dataset can be exported (for generating plastic space maps for instance). _Year_ of reference is fixed in the GUI interface. The matrix computation is preceded by the generation of multiple road edges in order to provide the minimum path algorithm with sufficient input data. The matrix is exported from the browser console (Ctrl + Shift + K or Command + Option + K) with the instruction:

  * ```bigBoard._merger.merge(true,'aFileNameForTheMatrix')```

## More parameters with the console

Instructions to the application can also be entered in the console (F12) of the browser

`shriveling.configuration.XXX=value`

with XXX and value in the following range:

-   intrudedHeightRatio : sets the height of cones, in the range [0,1], a ratio of the earth radius


## Testing lengths and angles

As the final output of the tool is, in the general case, an image, testing the distances and angles is a way to make sure the model is correct:

-   length of straight edges and links can be [measured with a ruler on the screen](https://timespace.hypotheses.org/115) or on a printed image
-   length of curves may be measured by means of a little string adjusted along the image and then measured with the ruler
-   measuring angles with [an on-line protractor tool](https://www.ginifab.com/feeds/angle_measurement/)
