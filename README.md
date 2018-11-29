shriveling the world
=====================

The  "shriveling_world" project aims at producing images of the global geographical time-space, using the third dimension, as in time-space relief maps.
The word "shriveling" was introduced by Waldo Tobler in his comments of L'Hostis-Mathis time-space relief image, in order to describe the complex contraction process suggested by the model.

# How to use

## Requisites
You need updated version of node.js, npm and nvm:
- https://stackoverflow.com/questions/6237295/how-can-i-update-nodejs-and-npm-to-the-next-versions

- ```nvm install node ```

Does not work with old version of nodejs (with version 4 does not work, with version 8 to 11 does)


## Compiling sources and launching the server
First you need to download sources from this github page. Copy the folder on your machine.
Go inside the application folder and open a terminal, execute the following lines, one by one:

```npm i```  (update nodejs)

```gulp```   (compile sources)

```gulp server``` (launch server)

Then open in browser this adress http://localhost:8080. 

## Introducing data in the application


Drag'n'drop the following geojson and csv files found in example/datas in the web app:
- cities.csv
- population.csv
- transport_mode_code.csv
- transport_mode_speed.csv
- transport_network.csv
- 110m_land_shrivel.geojson

## Instructions for use
Instructions for the application are provided in a lateral user interface.

Export to obj file format is available (red button in the bottom)

Instructions to the application can also be entered in the console (F12) of the browser

```shriveling.configuration.XXX=value```

with XXX and value in the following range:

- heightRatio : for the heigth of cones
- intrudedHeightRatio : for the heigth of cones
- coneStep :  modifies the visual aspect of cones (defautl value is 15 degrees)
- projectionInit : initial projection with values in in the following range : 
  - 'none' for a three dimensional unprojected representation
  - 'equirectangular' or 1 for an equilateral flat representation
  - 'Mercator' or 2 for a 2-dimensional Mercator
- projectionEnd : the final projection with value as projectionBegin
- projectionPercent: transition value between projectionBegin and projectionEnd. Value included in the range 0 to 100 included.
- year: base year of the representation (value in the networks files)
- pointsPerLine=X where X is an integer between 1 and 199 included. This value influences the way curves are drawn.




# Road map
https://github.com/theworldisnotflat/shriveling_world/wiki
