# predevals
A JavaScript module for interactive exploration of forecast evaluations.

# Development

## Installing dev requirements

### Node

You'll need to install Node.js and npm. Please see the installation instructions at https://docs.npmjs.com/downloading-and-installing-node-js-and-npm.

### Node packages

You must install the required Node.js packages via:

```bash
npm ci
```

`npm ci` installs the exact versions pinned in `package-lock.json` and fails if the lockfile has drifted from `package.json`. Prefer it over `npm install`: `npm install` is free to resolve *newer* versions than the lockfile pins, which silently leaves you building with a different toolchain than everyone else.

> [!IMPORTANT]
> Re-run `npm ci` whenever `package-lock.json` changes underneath you — after a `git pull`, a merge from `main`, a dependency bump, or a branch switch. A stale `node_modules` is the usual cause of committed bundles that don't reproduce (see [Rebuilding the bundles](#rebuilding-the-bundles)).

## Local development workflow

The `dev-example` folder has a minimal working example for local development, based on the [flusight-dashboard](https://github.com/reichlab/flusight-dashboard). To use this example for development, use the following commands, starting from the root of the `predevals` repository:

```bash
npm run build && cp dist/predevals.bundle.js dev-example/predevals.bundle.js
python3 -m http.server 8000 -d dev-example/
```

Then open http://127.0.0.1:8000/ in your web browser. As you make changes to `src/predevals.js`, re-run the build-and-copy line above and then refresh the page in your browser.

> [!IMPORTANT]
> The build-and-copy line above is for iterating in the browser only — editing `src/` doesn't change any dependency, so there's nothing to reinstall between refreshes. When the bundle you've built is going into a **commit**, use the longer sequence in [Rebuilding the bundles](#rebuilding-the-bundles), which adds `npm ci` up front.

## Rebuilding the bundles

Two copies of the bundle are committed to this repository, and both must be regenerated together:

- `dist/predevals.bundle.js` — what end users load from a tag via jsDelivr
- `dev-example/predevals.bundle.js` — what the local dev server serves

Whenever a change to `src/` is going into a commit, rebuild both from the pinned toolchain:

```bash
npm ci && npm run build && cp dist/predevals.bundle.js dev-example/predevals.bundle.js
git status   # both bundles should be the only unexpected changes
```

The leading `npm ci` is the part that's easy to skip and matters most. Building against a `node_modules` that is newer or older than `package-lock.json` produces a bundle that nobody else can reproduce — webpack's output shape itself changes between versions (for example, whether the bundle carries a runtime wrapper or is fully module-concatenated), so the committed artifact stops matching what the branch plus the lockfile actually build, and every subsequent bundle diff is noise.

To check that a bundle you're about to commit is reproducible, rebuild on a clean install and confirm the diff contains only your intended change:

```bash
npm ci && npm run build
git diff --stat dist/
```

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
4. **Rebuild both bundles** from the pinned toolchain so they reflect the latest source, then commit both (see [Rebuilding the bundles](#rebuilding-the-bundles) and [Packaging the component](#packaging-the-component)):

   ```bash
   npm ci && npm run build && cp dist/predevals.bundle.js dev-example/predevals.bundle.js
   ```

   Do not skip `npm ci` here — a release bundle built against a stale `node_modules` is not the artifact the tagged lockfile produces, and it's the copy end users load.

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

> Note on dependencies: `d3` is bundled into `dist/predevals.bundle.js` at build time (which is why it, like `webpack`, lives in `devDependencies` — end users load the prebuilt bundle rather than installing this package from npm). jQuery and Plotly are the exceptions: they are *not* bundled, and are instead expected as runtime globals supplied by the host dashboard page. The bundled `d3` is internal to the component and is not exposed to the host page — so if your host page uses `d3` itself (e.g. a `d3.csv` data-loading callback, as `dev-example` does), it must load its own copy.

```bash
npm ci && npm run build && cp dist/predevals.bundle.js dev-example/predevals.bundle.js
```

You'll then need to commit and push your updates (including both `dist/predevals.bundle.js` and `dev-example/predevals.bundle.js`) to GitHub.
