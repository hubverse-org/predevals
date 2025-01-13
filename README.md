# predeval
A JavaScript module for interactive exploration of forecast evaluations

# Development

## Node

You'll need to install Node.js and npm.  Please see the installation instructions at https://docs.npmjs.com/downloading-and-installing-node-js-and-npm.

## Installing dev requirements

You must install the required Node.js packages via:

```bash
npm install --save-dev
```

## Packaging the component

We use [webpack](https://webpack.js.org/) to package up all dependencies into a single `dist/predeval.bundle.js` file for end users. To do so, execute the `package.json` `build` script via the following command, which will update all files in `dist/`.

```bash
npm run build
```
