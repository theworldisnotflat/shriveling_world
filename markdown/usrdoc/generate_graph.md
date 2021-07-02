## Generate graph in QGIS

* Starting from a points layer
* Create a new _Vector layer_
* Toggle _edition_ mode
* Click _Add linear entity_ button
* Left click on nodes of the points layer
* Right click anywhere when the path is finished

Solution de Dylan 22 juin 2021:
Faire une "intersection"
Exporter en format .shp
"Boîte à outils de traitement" -> "Création de vecteurs" -> "Points vers lignes"
"Boîte à outils de traitement" -> "Géométrie vectorielle" -> "Exploser les lignes"
Ajouter les coordonnées géographiques X_begin; Y_begin; X_end; Y_end (longueur : 17; précision : 15) avec la calculatrice de champs "$X_at(0)"; "$Y_at(0)"; "X_at(1)"; "Y_at(1)"
Jointure spatiale : "joindre les attributs par localisation"
Enregistrer la couche