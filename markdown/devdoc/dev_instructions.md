# Requisites

You need updated version of node.js, npm and nvm:

-   [node latest version](https://github.com/nodesource/distributions/blob/master/README.md#deb)

-   `nvm install node `

Does not work with old version of nodejs (with version 4 does not work, with version 8 to 11 does)

# Configuration of your IDE

In your IDE, need to install xo extension :

-   [vscode-linter-xo](https://github.com/SamVerschueren/vscode-linter-xo) for vscode
-   [linter-xo](https://github.com/xojs/atom-linter-xo) for atom

# Compiling sources and launching the server

First you need to download sources from this github page. Copy the folder on your machine.
Go inside the application folder and open a terminal, execute the following lines, one by one:

`npm i` (update nodejs)

`npm run build` (compile sources)

`npm run dev` (quick compile sources, launch server)

Then open in a browser this address http://localhost:3000.

# Git tutorial

## Create Branch with GitKraken

On the left of GitKraken window, right-click on _master_, select _Create branch here_, and then write a name for the branch (in the example the branch will be named _TestDataSet_).

## Merge branch into distant _Master_

Once all changes are considered worth being pushed to _master_, _stage_ and _commit_ changes to the branch.

1. Before merging it is necessary to include in the in the local _master_ and in the branch the recent changes to the distant _master_. This is done by the instruction _pull rebase_. On the left of GitKraken window:
   * select the branch _master_ and do a _pull rebase_
   * right click on the branch _TestDataSet_ and run _Rebase master on TestDataSet_. Conflicts may have to be resolved.

2. Then in the branch in the upper left window of GitKraken, right click and, _Merge TestDataSet into master_ will introduce changes of the branch into the local _master_.

3. Finally _push_ the modifications to the distant _master_.

Alternatively: _Start a pull request to origin from origin/TestDataSet_