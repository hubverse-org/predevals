# predevals
A JavaScript module for interactive exploration of forecast evaluations.

# `App.initialize()` options

The `options` object passed to `App.initialize()` supports the following optional properties:

## `initial_sort_column`

Controls which column `#predeval_table` initially sorts on. Defaults to `model_id` (the Model column).

Specify the **`scores.csv` column name**, not the rendered column header. For example, pass `'wis'` to sort by the column displayed as `'WIS'`. The mapping of `scores.csv` column names to rendered headers is (via `score_col_name_to_text()`):

| `scores.csv` column name          | Rendered header           |
|-----------------------------------|---------------------------|
| `model_id`                        | Model                     |
| `n`                               | N                         |
| `wis`                             | WIS                       |
| `wis_scaled_relative_skill`       | Rel. WIS                  |
| `ae_median`                       | MAE                       |
| `ae_median_scaled_relative_skill` | Rel. MAE                  |
| `interval_coverage_50`            | 50% Cov.                  |
| *(other metrics)*                 | title-cased internal name |

The value is validated against all metrics and relative metrics defined across `options.targets`. Passing an unrecognized name raises an error via `_validateOptions()`.

**Limitations:**
- The sort direction is always ascending. For most metrics (e.g., `wis`, `ae_median`) ascending order is sensible, but for coverage metrics like `interval_coverage_50` - where higher values are better - descending order would be more natural. Sorting direction is not currently configurable.
- The sort is re-applied every time the table is rebuilt (e.g., when the user changes the target or evaluation set). Any manual column sort the user has applied will be reset on target/eval-set change.

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
cd dev-example
python3 -m http.server 8000
```

Then open http://127.0.0.1:8000/ in your web browser. As you make changes to `src/predevals.js`, rebuild and recopy the updated predevals.bundle.js into the `dev-example` folder and then refresh the page in your browser.

## Creating a release

### Packaging the component

We use [webpack](https://webpack.js.org/) to package up all dependencies into a single `dist/predevals.bundle.js` file for end users. To do so, execute the `package.json` `build` script via the following command, which will update all files in `dist/`.

```bash
npm run build
```

You'll then need to commit and push your updates (including `dist/predevals.bundle.js`) to GitHub.

### Creating a release

For each version, create a new release of the package on GitHub using `vX.Y.Z` for the GitHub tag and `release-vX.Y.Z` for the release title.  The release is now available for use via `jsdelivr`.
