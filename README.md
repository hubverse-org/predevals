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

## Running unit tests

We use [QUnit](https://qunitjs.com/) for our unit tests. To run the tests, execute the `package.json` `test` script: `npm run test`. You should see output at the bottom like this (the pass count grows as tests are added):

```bash
...
# pass 16
# skip 0
# todo 0
# fail 0
```

## Versioning

We follow a `-dev` prerelease convention for the `version` field in `package.json`:

- **Between releases**, `main` carries a `-dev` suffix on the next expected version (e.g. `1.2.1-dev` after tagging `v1.2.0`).
- **Feature PRs do not touch the version.** Leave `package.json` (and `package-lock.json`) on the current `-dev` value, even when your PR is the feature. The bump (patch / minor / major per [SemVer](https://semver.org/)) is decided at release time based on everything that landed, so the `-dev` number is only a placeholder for the *next expected* release, not a promise.
- **The release** drops `-dev`, sets the final version, and cuts a matching tag — see [Creating a release](#creating-a-release) for the full checklist.
- **After release**, a follow-up PR bumps to the next `-dev` (e.g. `1.2.2-dev`).

> [!TIP]
> Keep `-dev` in place during feature work. Setting a final version happens as part of the release process (see below), where it's paired with a matching `vX.Y.Z` tag. That way in-development work on `main` is always clearly marked with `-dev`, and any released (full) version always corresponds to an actual tag.

A full cycle looks like:

| Step | `package.json` version | Tag |
| --- | --- | --- |
| Release `v1.2.0` | `1.2.0` | `v1.2.0` |
| Post-release bump | `1.2.1-dev` | — |
| Feature PR merges | `1.2.1-dev` (unchanged) | — |
| Another feature PR merges | `1.2.1-dev` (unchanged) | — |
| Bugfix PR merges | `1.2.1-dev` (unchanged) | — |
| Release PR | `1.2.1` | `v1.2.1` |
| Post-release bump | `1.2.2-dev` | — |

> [!NOTE]
> End users load the bundle from a Git **tag** via [jsDelivr](https://www.jsdelivr.com/) (the `@v1` float resolves to the latest `v1.x.y` tag). The `version` field in `package.json` is not what gets served — it's a convention for developers to track the next release, so keep it in step with the tags.

## Creating a release

Once the team agrees `main` is ready to release, follow this checklist. It mirrors the [Hubverse release checklists](https://hubverse-org.github.io/hubDevs/articles/release-checklists.html), adapted for this JavaScript package.

1. **Decide the version bump.** Based on everything that landed since the last tag, pick patch / minor / major per [SemVer](https://semver.org/). This becomes `X.Y.Z` (the `-dev` placeholder on `main` is just a starting guess — override it if what actually landed warrants a different bump).
2. **Open a release branch** off `main`, named `<author>/release/vX.Y.Z` (e.g. `ak/release/v1.2.1`).
3. **Set the release version.** In `package.json` and `package-lock.json`, drop `-dev` and set the final `X.Y.Z`.
4. **Rebuild the bundle** so `dist/` reflects the latest source (see [Packaging the component](#packaging-the-component)):

   ```bash
   npm run build
   ```

   Then sync the built bundle into the dev example and commit both:

   ```bash
   cp dist/predevals.bundle.js dev-example/predevals.bundle.js
   ```

5. **Open a PR and get a review** from another member of the dev team. Merge into `main` once approved.
6. **Cut the tag.** On the merge commit, create an annotated (`-a`) or signed (`-s`) tag named `vX.Y.Z` and push it:

   ```bash
   git checkout main && git pull
   git tag -a v1.2.1 -m "v1.2.1"
   git push origin v1.2.1
   ```

7. **Create the GitHub release** from the new tag, using `vX.Y.Z` for the tag and `release-vX.Y.Z` for the release title. The release is now available for use via [jsDelivr](https://www.jsdelivr.com/).
8. **Bump to the next dev version.** Open a follow-up PR (branch `<author>/post-release-vX.Y.Z`) that sets `package.json` and `package-lock.json` to the next `-dev` (e.g. `1.2.2-dev`).

### Packaging the component

We use [webpack](https://webpack.js.org/) to package up all dependencies into a single `dist/predevals.bundle.js` file for end users. The `build` script (run in step 4 above) regenerates all files in `dist/`. End users always load the tagged bundle via jsDelivr, so the committed `dist/` bundle must be rebuilt and included as part of the release.
