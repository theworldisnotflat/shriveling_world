# Shriveling World in Blender

## Intro

[Shriveling World](https://theworldisnotflat.github.io/shriveling_world_documentation) is a web app intended to explore shriveled maps (multi-modal maps) of different datasets directly in your browser.

The application allows you to get an accurate representation of the model through interactive parameters.
But it is now easier to use advanced 3D software to fine tune the appearance of the outputs.

## Why Blender?

We chose [Blender](https://www.blender.org) because it’s a free and cross platform open source 3D creation suite that allows advanced shading, lighting and rendering options to tweak the visual output of the Shriveling World app.

Of course any 3D tool could be used as long as it supports .obj file.

**[Download Blender](https://www.blender.org/download/)**
(2.90.1 as of 16 october 2020)

The tutorial below is designed as a quick start to import data from the Shriveling App and effectively organize your scene in Blender[^version].


## Step by step [(ooh 🔊)](https://www.youtube.com/watch?v=iCrargw1rrM)

After exporting from app you should have 3 files:

- _sceneCones.obj_, base geometry for terrestrial transport
- _sceneCurvesLongHaul.obj_, long distance flights
- _sceneCurvesShortHaul.obj_, short distance flights

Let’s get started.

### Import OBJ

1. Open Blender
2. New File > General
3. With your mouse in the [_3D Viewport_](https://docs.blender.org/manual/en/latest/interface/window_system/introduction.html) editor’s area **remove everything in the scene**
    - Press **A** (Select All)
	- Press **X** (then confirm by pressing **D**, **Enter** or click **“Delete”** in the contextual pop-up) or press **BackSpace** (for instant delete)
4. File > Import > Wavefront (.obj)

 In the _Blender File View_, find and select the .obj file on your system, then click **Import OBJ** or press **Enter**. The OBJ import allows only one file at a time.

 For the sake of organization we will import each .obj file in a [collection](https://docs.blender.org/manual/en/latest/scene_layout/collections/introduction.html). We could do this by creating a collection for each additional import and renaming each collection to our needs in the [_Outliner_](https://docs.blender.org/manual/en/latest/editors/outliner.html).

 Select the desired collection in the _Outliner_ before importing the corresponding file as mentioned before.

Now we have imported our meshes, we can work in Blender as we like.
Tweak the geometry, set materials, lights, cameras and make renders.

However a few tips could be helpful.

### Working with 3D objects

<small>J’inclus (temporairement) une [initiation à la modélisation sous Blender](https://perso.liris.cnrs.fr/vincent.nivoliers/mif27/tuto_blender28.php) en français (comme l’équipe actuelle est essentiellement francophone). Son auteur [Vincent Nivoliers](https://perso.liris.cnrs.fr/vincent.nivoliers/) travaille comme assistant professeur à [LIRIS](https://liris.cnrs.fr) (je suis tombé dessus totalement par hasard) mais revenons à nos moutons…</small>


#### Cones

The shriveled topology exported as .obj file is composed of individual “cones” each named by city.

It is quite hard to keep accurate geometry when trying to model the mesh surface depending of the source file and its complexity. But one method looks promising.

1. In the _Outliner_, duplicate the cones collection (so we can keep track of original cones for comparison later).
2. <a id="hide"></a>Hide everything but the new working collection by **ctrl-clicking** on the **eye icon** next to it (isolate to optimise the viewport)
3. [Select all objects](https://docs.blender.org/manual/en/latest/editors/outliner.html#selecting-multiple-data-blocks) (cones) of that new collection. One object must be active (yellow) in the objects selection (orange). It will become the main object.
4. In the _3D Viewport_, join every selected cone meshes in one object (**Ctrl-J** or **Cmd-J** on macOS). You can rename the joined object as you like.
5. Switch to *Sculpt Mode* and use the **[Remesh](https://docs.blender.org/manual/en/latest/modeling/meshes/retopology.html#remeshing)** tool in the top-right corner of the _3D Viewport_ area (the Blender doc about remeshing is unfortunately not up to date). _Voxel Size_ should be 0.1 or less (**Warning**: it could be computational intensive but a lower value gives more details).
6. Add *Decimate modifier* to lighten the mesh.
7. WIP Boolean the geographic borders. Need source.
8. WIP Remove vertices of the bases to keep only the surface (non manifold object)

#### Parabolas / Curves

Depending on the value set for _Curves > number of_[^naming] before exporting, results may vary (higher number should give more accurate curves).

In Blender, the straightforward way to work with things that looks like curve is using, guess what, _[Curves](https://docs.blender.org/manual/en/latest/modeling/curves/introduction.html)_! We are going to convert our faceless meshes to real curves… but before that:

<small>Temporary comment:</small>
For now the exported mesh geometry for “curves” include center reference vertex for each “curve”. If we find a solution it would be nice to export the .obj file without those center vertices.

Let’s remove those vertex in Blender:

1. Toggle X-Ray (with your mouse in the top right corner of the  _3D Viewport_ press **Alt+Z** or click on the <img src="./img/icon_x-ray@2x.png" alt="X-Ray Icon Inactive" title="X-Ray Icon Inactive" width="20" height="20" /> icon) to enable the selection of overlapping elements.
2. Select all the “curve” objects. Either :
	-  by pressing **A** (Select All) while your mouse is in the _3D Viewport_ (and with only the wanted objects visible)
	- with one of the _[selection tools](https://docs.blender.org/manual/en/latest/interface/selecting.html#selection-tools)_
	- with the _[Outliner](https://docs.blender.org/manual/en/latest/scene_layout/view_layers/introduction.html#outliner)_.
	**Warning:** depending on context (for example if the last active object was hidden from view), one pitfall could be a selection with no active object at all (with only orange outline). Be sure to have an [active object](https://docs.blender.org/manual/en/latest/scene_layout/object/selecting.html#selections-and-the-active-object) (with yellow outline) in the selection before continuing.
3. Switch to _Edit Mode_ (Press **Tab**).
4. Select all the vertices located at the World Origin with the _Select Box_ tool.
5. Delete them (Press **X** then **Enter**).
6. Switch to _Object Mode_ (Press **Tab**).
7. Convert still selected objects to curve (_Object > Convert to > Curve from Mesh/Text_ or press **F3** (Menu Search), type “convert” and choose corresponding function).
8. Open _Object Data Properties_ [tab](https://docs.blender.org/manual/en/latest/interface/window_system/tabs_panels.html) located at the bottom right.
9. Check that _Fill Mode_ is set to “Full”.
10. Open _[Geometry](https://docs.blender.org/manual/en/latest/modeling/curves/properties/geometry.html#)_ panel and in the _Bevel_ [subpanel](https://docs.blender.org/manual/en/latest/interface/window_system/tabs_panels.html#panels) set _Depth_.

To apply properties to all selected objects (because changes you make in _Object Data Properties_ only affect active object) **right click** on the modified _[Fields](https://docs.blender.org/manual/en/latest/interface/controls/buttons/fields.html)_ to open a contextual menu and choose _Copy to Selected_. 🎉

### Rendering

WIP Define basic setups for effective renders (with [EEVEE](https://docs.blender.org/manual/en/latest/render/eevee/introduction.html), [Cycles](https://docs.blender.org/manual/en/latest/render/cycles/introduction.html) or even _[Workbench](https://docs.blender.org/manual/en/latest/render/workbench/introduction.html)_).

#### Camera

WIP Explain different [Camera](https://docs.blender.org/manual/en/latest/render/cameras.html#properties) settings (*Orthographic* vs *Perspective* for example) specific to Shriveling.

#### Materials / Shading / Lighting

WIP Explain briefly which _[Materials](https://docs.blender.org/manual/en/latest/render/materials/introduction.html)_ and/or _[Shaders](https://docs.blender.org/manual/en/latest/render/shader_nodes/introduction.html)_ to use to get nice results.

WIP PBR vs NPR, shadeless, transparency, colors…

#### Lights

WIP Set guidelines, hints…


[^version]: Note: Blender evolves quickly. Since version 2.79b the whole interface has changed and a lot of new features are implemented. The base concepts stay the same so you could get interesting results with any version suited to your computer. However, this tutorial is clearly geared towards recent versions (since 2.80).

[^naming]: In the web-app the naming could be subject to change. “There are only two hard things in Computer Science: cache invalidation and naming things.” -- Phil Karlton. [Some jokes about that infamous quote](https://martinfowler.com/bliki/TwoHardThings.html), [Reference from David Karlton (Phil’s son)](https://www.karlton.org/2017/12/naming-things-hard/ ) and BTW [Stack exchange is your second best friend after Google](https://skeptics.stackexchange.com/questions/19836/has-phil-karlton-ever-said-there-are-only-two-hard-things-in-computer-science)