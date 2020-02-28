Shriveling the world
=====================

The  "shriveling_world" project aims at producing images of the global geographical time-space, using the third dimension, as in time-space relief maps.
The word "shriveling" was introduced by Waldo Tobler in his comments of Mathis-L'Hostis time-space relief image, in order to describe the complex contraction process suggested by the model.
A [scientific blog](https://timespace.hypotheses.org/) contains principles, reflections, references and images related to this project.

# How to use

## For users
The app runs in a browser from this adress:
[Shriveling world](https://theworldisnotflat.github.io/shriveling_world_documentation/)


## Introducing data in the application


Drag'n'drop the following geojson and csv files found in the folder datasets in the web app:
- cities.csv
- population.csv
- transport_mode_code.csv
- transport_mode_speed.csv
- transport_network.csv
- 110m_land_shrivel.geojson

## Instructions for use
Instructions for the application are provided in a lateral user interface.

Export to gltf (.obj) file format is available (red button in the bottom). In order to import in Blender the file produced from the app, [a Blender plugin must be installed](https://github.com/ksons/gltf-blender-importer)

Instructions to the application can also be entered in the console (F12) of the browser

```shriveling.configuration.XXX=value```

with XXX and value in the following range:

- intrudedHeightRatio : sets the heigth of cones, in the range [0,1], a ratio of the earth radius

For these other command lines an UI already exists
- coneStep :  modifies the visual aspect of cones (default value is 15 degrees, a facet = 15°)
- projectionInit : initial projection with values in in the following range :
  - 'none' for a three dimensional unprojected representation
  - 'equirectangular' or 1 for an equilateral flat representation
  - 'Mercator' or 2 for a 2-dimensional Mercator
- projectionEnd : the final projection with value as projectionBegin
- projectionPercent: transition value between projectionBegin and projectionEnd. Value included in the range 0 to 100 included.
- year: base year of the representation (value in the networks files)
- pointsPerLine=X where X is an integer between 1 and 199 included. This value influences the way curves are drawn. The value **zero** draws all straight lines, while the value **1** draws broken lines

## Testing lengths and angles

As the final output of the tool is, in the general case, an image, testing the distances and angles is a way to make sure the model is correct:
- length of straight edges and links can be [measured with a ruler on the screen](https://timespace.hypotheses.org/115) or on a printed image
- length of curves may be measured by means of a little string adjusted along the image and then measured with the ruler
- measuring angles with [an on-line protractor tool](https://www.ginifab.com/feeds/angle_measurement/)



## For developpers

### Requisites
You need updated version of node.js, npm and nvm:
- [node latest version](https://github.com/nodesource/distributions/blob/master/README.md#deb)

- ```nvm install node ```

Does not work with old version of nodejs (with version 4 does not work, with version 8 to 11 does)


### Compiling sources and launching the server
First you need to download sources from this github page. Copy the folder on your machine.
Go inside the application folder and open a terminal, execute the following lines, one by one:

```npm i```  (update nodejs)

```gulp```   (compile sources) or ``` gulp --testing --debug``` for development (faster, does not minify)

```gulp server``` (launch server)

```gulp doc``` (compile documentation)

Then open in a browser this adress http://localhost:8080.


# Road map
A [roadmap is maintained up to date here](https://github.com/theworldisnotflat/shriveling_world/wiki)
