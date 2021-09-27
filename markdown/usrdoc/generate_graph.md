## Generate graph in QGIS

* Starting from a points layer
* Use QuickOSM plugin
  * Layer = choose an existing layer in your project
  * key = 'route'
  * Value = 'road'
* Create a new _Vector layer_
* Toggle _edition_ mode
* Click _Add linear entity_ button
* Left click on nodes of the points layer
* Right click anywhere when the path is finished

* From the 'ToolBox' execute in 'Vectorial Geometry' the tool 'ExplodeLines'; This will generate one line per segment of each polylines
* Create four new 'real' fields as follows:
   * start_x with value x(start_point($geometry))
   * start_y with value y(start_point($geometry))
   * end_x with value x(end_point($geometry))
   * end_y with value y(end_point($geometry))

* In the points layer execute script "Add geometry attributes"; this will add columns with x and y of points


Solution de Dylan 22 juin 2021:
Faire une "intersection"
Exporter en format .shp
"Boîte à outils de traitement" -> "Création de vecteurs" -> "Points vers lignes"
"Boîte à outils de traitement" -> "Géométrie vectorielle" -> "Exploser les lignes"
Ajouter les coordonnées géographiques X_begin; Y_begin; X_end; Y_end (longueur : 17; précision : 15) avec la calculatrice de champs "$X_at(0)"; "$Y_at(0)"; "X_at(1)"; "Y_at(1)"
Jointure spatiale : "joindre les attributs par localisation"
Enregistrer la couche