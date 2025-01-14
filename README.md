# predeval
A JavaScript module for interactive exploration of forecast evaluations.

# Development

## Installing dev requirements

### Node

You'll need to install Node.js and npm. Please see the installation instructions at https://docs.npmjs.com/downloading-and-installing-node-js-and-npm.

### Node packages

You must install the required Node.js packages via:

```bash
npm install --save-dev
```

## Local development workflow

The `dev-example` folder has a minimal working example for local development, based on the [flusight-dashboard](https://github.com/reichlab/flusight-dashboard). To use this example for development, we recommend editing only the `src/predeval.js` script, and copying any updates to that script into `dev-example` to test changes. This can be achieved with the following commands, starting from the root of the `predeval` repository:

```bash
cp src/predeval.js dev-example
cd dev-example
python3 -m http.server 8000
```

Then open the displayed link (typically http://[::]:8000/) in your web browser.  As you make changes to `src/predeval.js`, copy the updated file into the `dev-example` folder and refresh the page in your browser.

## Creating a release

### Packaging the component

We use [webpack](https://webpack.js.org/) to package up all dependencies into a single `dist/predeval.bundle.js` file for end users. To do so, execute the `package.json` `build` script via the following command, which will update all files in `dist/`.

```bash
npm run build
```

You'll then need to commit and push your updates (including `dist/predeval.bundle.js`) to GitHub.

### Creating a release

For each version, create a new release of the package on GitHub using `vX.Y.Z` for the GitHub tag and `release-vX.Y.Z` for the release title.  The release is now available for use via `jsdelivr`.
