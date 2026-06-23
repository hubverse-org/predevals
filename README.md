# predevals
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

The `dev-example` folder has a minimal working example for local development, based on the [flusight-dashboard](https://github.com/reichlab/flusight-dashboard). To use this example for development, use the following commands, starting from the root of the `predevals` repository:

```bash
npm run build
cp dist/predevals.bundle.js dev-example
python3 -m http.server 8000 -d dev-example/
```

Then open http://127.0.0.1:8000/ in your web browser. As you make changes to `src/predevals.js`, rebuild and recopy the updated predevals.bundle.js into the `dev-example` folder and then refresh the page in your browser.

## Versioning

We follow a `-dev` prerelease convention for the `version` field in `package.json`:

- **Between releases**, `main` carries a `-dev` suffix on the next expected version (e.g. `1.2.1-dev` after tagging `v1.2.0`).
- **Feature PRs do not touch the version.** The bump (patch / minor / major per [SemVer](https://semver.org/)) is decided at release time based on what landed.
- **The release PR** drops `-dev` and sets the final version (e.g. `1.2.0`).
- **After release**, a follow-up PR bumps to the next `-dev` (e.g. `1.2.1-dev`).

> [!NOTE]
> End users load the bundle from a Git **tag** via [jsDelivr](https://www.jsdelivr.com/) (the `@v1` float resolves to the latest `v1.x.y` tag). The `version` field in `package.json` is not what gets served — it's a convention for developers to track the next release, so keep it in step with the tags.

## Creating a release

### Packaging the component

We use [webpack](https://webpack.js.org/) to package up all dependencies into a single `dist/predevals.bundle.js` file for end users. To do so, execute the `package.json` `build` script via the following command, which will update all files in `dist/`.

```bash
npm run build
```

You'll then need to commit and push your updates (including `dist/predevals.bundle.js`) to GitHub.

### Creating a release

For each version, create a new release of the package on GitHub using `vX.Y.Z` for the GitHub tag and `release-vX.Y.Z` for the release title.  The release is now available for use via `jsdelivr`.
