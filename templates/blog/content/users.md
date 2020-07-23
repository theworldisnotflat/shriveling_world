+++
title = "User instructions"
date = 2020-03-19T06:59:00+01:00
draft = true
tags = []
categories = []
+++


## First steps
**Step #1**:The app runs in a browser from this adress:

[Shriveling world]({{$.Site.BaseURL/app/>}})

**Step #2**: Once the app runs in the browser data is read in two ways:

a. Cick on predefined dataset list on the left side of the broser window
b. Introduce data in the app by grag'n'drop (see below)

Attention: in any case data processing may take time, depending on the number of cities. So once data is introduced, just wait. Seconds or a few minutes should suffice.

**Step #3**: enjoy! navigate around the threedimensional structure with mouse controls; define projection through interface; define desired control parameters through the interface on the right. Reload the page in the browser before changing dataset.

## Introducing data in the application by drag'n'drop

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

For these other following command lines an UI already exists (indicated here as a backup solution)
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
