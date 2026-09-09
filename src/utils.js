function titleCase(str) {  // per https://stackoverflow.com/questions/196972/convert-string-to-title-case-with-javascript
    return str.toLowerCase().replace(/\b\w/g, s => s.toUpperCase());
}

function hexToRGB(hex) {
    let r = parseInt(hex.substring(1, 3), 16);
    let g = parseInt(hex.substring(3, 5), 16);
    let b = parseInt(hex.substring(5, 7), 16);
    return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Return the number of decimal places to use when rendering a score column.
 *
 * - `*_scaled_relative_skill` columns always use 2 decimal places.
 * - `interval_coverage_*` columns always use 1 (values are 0-100 percentages).
 * - All other columns: when `values` is supplied, returns the decimals that resolve the column's
 *   variation (see `score_decimals`); otherwise falls back to 1.
 *
 * @param {string} col_name
 * @param {Array<number>|null} [values=null]
 * @returns {number}
 */
function get_round_decimals(col_name, values = null) {
    if (is_relative_skill_col(col_name)) {
        return 2;
    }
    if (!is_coverage_col(col_name) && values !== null) {
        return score_decimals(values);
    }
    return 1;
}

/**
 * Decimals for a score column, chosen so the displayed digits resolve the column's variation
 * ("two effective digits", Ehrenberg 1977, JRSS A 140(3), 277-297), capped so the column never
 * carries more than `maxSigFigs`. Display only: never applied to sort keys or downloaded data.
 *
 * Both anchors are quantiles rather than extremes: the range is set by the worst model, but the
 * comparison that matters is among the contenders at the top, so neither one blown-up submission
 * (which would flatten the leaderboard through the cap) nor one near-zero score (which would pad
 * every other row with spurious decimals) gets to set the whole column's precision.
 *
 * Because the rule is decimals-based (`toFixed`) rather than significant-figure-based (R's
 * `signif`), it never rounds digits left of the decimal point: a national-scale MAE of 12345.6
 * renders as `12346`, never `12300`. `maxSigFigs` only ever removes decimals, and it bottoms out
 * at 0.
 *
 * Note: depends on the rows currently in `scores_table`, so precision can shift under filtering.
 * That is inherent to any column-wide rule, and is the price of keeping decimal points aligned.
 *
 * @param {Array<number|null|undefined>} values
 * @param {Object} [options]
 * @returns {number}
 */
function score_decimals(values, {effDigits = 2, fallbackSigFigs = 3, maxSigFigs = 5, maxDecimals = 6} = {}) {
    const vals = values.filter(v => v !== null && v !== undefined && isFinite(v));
    const nonZeroAbs = vals.filter(v => v !== 0).map(Math.abs);
    if (nonZeroAbs.length === 0) return 0;

    // epsilon guards floating-point overshoot, e.g. log10(0.001) === -3.0000000000000004
    const mag = (x) => Math.floor(Math.log10(x) + 1e-10);
    const quantile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)))];
    const sorted = [...vals].sort((a, b) => a - b);

    // fall back to the full range when the IQR is degenerate (few rows, or many ties)
    const spread = (quantile(sorted, 0.75) - quantile(sorted, 0.25)) || (sorted[sorted.length - 1] - sorted[0]);
    const large = quantile([...nonZeroAbs].sort((a, b) => a - b), 0.75);
    const d_spread = spread > 0 ? effDigits - 1 - mag(spread)
                                : fallbackSigFigs - 1 - mag(large);
    const d_cap = maxSigFigs - 1 - mag(large);
    return Math.min(Math.max(d_spread, 0), Math.max(d_cap, 0), maxDecimals);
}

/**
 * Render one score cell as a string. `decimals` comes from `get_round_decimals()`, computed once
 * per column so that decimal points line up down the column.
 *
 * Values too small to survive the column's rounding render as `<0.01` (or `>-0.01`) rather than as
 * a bare `0`, which is what keeps a column-wide rule from claiming a real non-zero score is zero.
 *
 * @param {string} col_name
 * @param {number|null|undefined} value
 * @param {number} decimals
 * @returns {string}
 */
function render_score(col_name, value, decimals) {
    if (value === null || value === undefined || !isFinite(value)) {
        return '';
    }
    if (is_relative_skill_col(col_name)) {
        return value.toFixed(2);
    }
    if (is_coverage_col(col_name)) {
        return value.toFixed(1);
    }
    const smallest = Math.pow(10, -decimals);
    if (value !== 0 && Math.abs(value) < smallest / 2) {
        return (value < 0 ? '>-' : '<') + smallest.toFixed(decimals);
    }
    return value.toFixed(decimals);
}


function parse_coverage_rate(score_name) {
    return parseFloat(score_name.slice(18));
}

/**
 * Split a transformed-scale column name like `wis__log` into its base metric
 * (`"wis"`) and transform label (`"log"`). Returns `null` for legacy column
 * names without `__`, which the rest of the app can render as-is.
 *
 * @param col_name {String} - a column name from `scores.csv` / `predevals-options.json`
 * @returns {{base: String, label: String} | null}
 */
function split_transformed_col_name(col_name) {
    const sepIdx = col_name.indexOf('__');
    if (sepIdx === -1) return null;
    return {base: col_name.slice(0, sepIdx), label: col_name.slice(sepIdx + 2)};
}

/**
 * Resolve a column name to its base metric: the part before `__` for a
 * transformed-scale column, or the input unchanged for any other column.
 *
 * @param col_name {String}
 * @returns {String}
 */
function base_col_name(col_name) {
    const split = split_transformed_col_name(col_name);
    return split ? split.base : col_name;
}

/**
 * Is `col_name` an `n` (scored-count) column? hubPredEvalsData emits a single
 * `n` column in the common case, or per-output-type `n_<output_type>` columns
 * (e.g. `n_quantile`) when the count diverges across output types for a target.
 *
 * @param col_name {String}
 * @returns {Boolean}
 */
function is_n_col(col_name) {
    return col_name === 'n' || col_name.startsWith('n_');
}

/**
 * Is `col_name` an `interval_coverage_*` column? These are percentages on a fixed 0–100 domain
 * (`convertDataColumnTypes()` scales them), which is why they get special handling in rounding,
 * labelling, and axis ranges.
 *
 * @param col_name {String}
 * @returns {Boolean}
 */
function is_coverage_col(col_name) {
    return /^interval_coverage_/.test(col_name);
}

/**
 * Is `col_name` a `*_scaled_relative_skill` column? These compare a model to the baseline, so they
 * are centered on 1.0 rather than on 0, which is why they get special handling in rounding, color
 * scales, and reference lines. Matched against the base metric, so transformed-scale columns
 * (`wis_scaled_relative_skill__log`) count too.
 *
 * @param col_name {String}
 * @returns {Boolean}
 */
function is_relative_skill_col(col_name) {
    return /_scaled_relative_skill$/.test(base_col_name(col_name));
}

/**
 * Return the y value a horizontal reference line should be drawn at for `col_name`, or `null` for
 * metrics that have no meaningful reference. Interval coverage is read against its nominal level
 * (a 0-100 percentage, matching the scaling `convertDataColumnTypes()` applies), and relative skill
 * against the baseline, which is 1.0 by construction - including on a transformed scale, where the
 * transform is applied to the scores before the pairwise comparison.
 *
 * @param col_name {String}
 * @returns {Number|null}
 */
function reference_line_value(col_name) {
    if (is_coverage_col(col_name)) {
        return parse_coverage_rate(col_name);
    }
    if (is_relative_skill_col(col_name)) {
        return 1;
    }
    return null;
}

const score_col_name_to_text_map = new Map(
    [
        ['model_id', 'Model'],
        ['wis', 'WIS'],
        ['wis_scaled_relative_skill', 'Rel. WIS'],
        ['ae_median', 'MAE'],
        ['ae_median_scaled_relative_skill', 'Rel. MAE'],
        ['ae_point', 'MAE'],
        ['ae_point_scaled_relative_skill', 'Rel. MAE'],
        ['se_point', 'MSE'],
        ['se_point_scaled_relative_skill', 'Rel. MSE']
    ]
)

/**
 * Converts a score column name to a human-readable string.
 * @param {String} score_name - the name of a column in a scores data object
 */
function score_col_name_to_text(score_name) {
    if (is_n_col(score_name)) {
        // `n` columns (`n` / `n_<output_type>`) all render as `N`.
        return 'N';
    }
    if (is_coverage_col(score_name)) {
        // interval_coverage_* are transform-invariant per the
        // predevals-options.json contract, so no `__<label>` variant exists.
        return `${parse_coverage_rate(score_name)}\% Cov.`;
    }
    const split = split_transformed_col_name(score_name);
    const base = split ? split.base : score_name;
    const baseText = score_col_name_to_text_map.get(base) || titleCase(base);
    return split ? `${baseText} (${split.label})` : baseText;
}

/**
 * Does an in-place conversion of `data`'s score and `n` columns' data types: Scores convert to floats, and `n`
 * columns (`n` / `n_<output_type>`) to ints.
 *
 * @param disaggregateBy {String} - an `App.state.selected_disaggregate_by` value
 * @param data {Array} - as returned by _fetchData() - a d3.csv() object
 */
function convertDataColumnTypes(disaggregateBy, data) {
    for (const col_name of data.columns) {
        if (col_name === 'model_id' || col_name === disaggregateBy) {
            // leave model_id and the disaggregate-by column unchanged
            continue;
        }
        if (is_n_col(col_name)) {
            // `n` column, so convert values in all rows to int
            for (let i = 0; i < data.length; i++) {
                data[i][col_name] = parseInt(data[i][col_name]);
            }
        } else {
            // score column, so convert values in all rows to float
            for (let i = 0; i < data.length; i++) {
                data[i][col_name] = parseFloat(data[i][col_name]);

                // If it's an interval coverage column, multiply by 100
                if (is_coverage_col(col_name)) {
                    data[i][col_name] *= 100;
                }
            }
        }
    }
}

/**
 * Coerce a `string | array | null | undefined` field into an array. Used to normalize target
 * fields whose schema (`inst/schema/v1.0.1/config_schema.json`) allows either form.
 *
 * @param value {String|Array|null|undefined} - the field value to coerce
 * @returns {Array} - `value` as an array (empty if null/undefined)
 */
function toArray(value) {
    if (value == null) return [];
    return Array.isArray(value) ? value : [value];
}


/**
 * Classify x-axis values so that their sort order and their Plotly axis type come from one
 * decision. Task id values reach the plot as strings (`convertDataColumnTypes()` leaves the
 * disaggregate_by column alone), so the kind has to be sniffed from the values themselves — the
 * hub config declares which task ids exist but not what type their values are.
 *
 * @param values {Array} - unique x-axis values, as strings
 * @returns {String} - 'date', 'numeric', or 'category' (the fallback, including for no values)
 */
function axis_kind(values) {
    if (values.length === 0) return 'category';
    // anchored at both ends: Plotly cannot parse a value that merely starts with a date (e.g. a
    // task_id_text label like '2025-01-06 (EW02)'), and a date axis it cannot parse renders blank
    if (values.every(value => /^\d{4}-\d{2}-\d{2}$/.test(value))) return 'date';
    if (values.every(value => value !== '' && !isNaN(value))) return 'numeric';
    return 'category';
}

export {titleCase, hexToRGB, score_decimals, render_score, get_round_decimals, parse_coverage_rate, split_transformed_col_name, base_col_name, is_n_col, is_coverage_col, is_relative_skill_col, reference_line_value, score_col_name_to_text, convertDataColumnTypes, toArray, axis_kind}
