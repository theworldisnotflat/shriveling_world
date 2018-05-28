shriveling the world
=====================

The  "shriveling_world" project aims at producing images of the global time-space, using the third dimension, as in time-space relief maps.
The word "shriveling" was introduced by Waldo Tobler in his comments of L'Hostis-Mathis time-space relief image, in order to describe the complex contraction process suggested by the model.

# How to use
TODO

# How to
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
and go to http://localhost:8080 . 

## First instructions

Drag'n'drop the following geojson and csv files found in example/datas in the web app:
- cities.csv
- population.csv
- transport_mode_code.csv
- transport_mode_speed.csv
- transport_network.csv
- 110m_land_shrivel.geojson


# Road map
- [X] create classes for the generation of cones
- [X] create a board class to manage cones
- [ ] create bigboard to manage all the application
- [ ] incorpore the parser of csv in order to provide some cones
