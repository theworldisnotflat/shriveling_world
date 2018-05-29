shriveling the world
=====================

The  "shriveling_world" project aims at producing images of the global time-space, using the third dimension, as in time-space relief maps.
The word "shriveling" was introduced by Waldo Tobler in his comments of L'Hostis-Mathis time-space relief image, in order to describe the complex contraction process suggested by the model.

# How to use

## launch server
Go in the application folder and open a terminal:
```
gulp server
```
then open in browser http://localhost:8080. 

## Introducing data in the application


Drag'n'drop the following geojson and csv files found in example/datas in the web app:
- cities.csv
- population.csv
- transport_mode_code.csv
- transport_mode_speed.csv
- transport_network.csv
- 110m_land_shrivel.geojson

## First instructions
Instructions to the application are entered in the console (F12) of the browser
```
Shriveling.Configuration.XXX=value
```
with XXX and value in the following range:

- heightRatio : for the heigth of cones
- intrudedHeightRatio : for the heigth of cones
- coneStep :  modifies the visual aspect of cones (defautl value is 15 degrees)
- projectionBegin : initial projection in the following range : 
-- 'none' for a three dimensional unprojected representation
-- 'equirectangular' or 1 for an equilateral flat representation
-- 'Mercator' or 2 for a 2-dimensional Mercator
- projectionEnd : the final projection with value as projectionBegin
- projectionPercent: transition value between projectionBegin and projectionEnd. Value included in the range 0 to 100 included.
- year: base year of the representation (value in the networks files)


## install
```
npm i
```
## build
```
gulp
```
## launch server
```
gulp server
```
and go to http://localhost:8080. 




# Road map
- [X] create classes for the generation of cones
- [X] create a board class to manage cones
- [ ] create bigboard to manage all the application
- [x] incorpore the parser of csv in order to provide some cones
- [ ] draw edges
