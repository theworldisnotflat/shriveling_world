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

`npm run dev` (compile sources, launch server)

Then open in a browser this address http://localhost:3000.

