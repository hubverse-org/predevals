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
 * - `interval_coverage_*` columns always use 1 (values are 0–100 percentages).
 * - All other columns: when `values` is supplied, returns the minimum decimals
 *   needed so that no non-zero value rounds to zero (see `min_decimals_for_values`);
 *   otherwise falls back to 1.
 *
 * @param {string} col_name
 * @param {Array<number>|null} [values=null]
 * @returns {number}
 */
function get_round_decimals(col_name, values = null) {
    const relative_skill_regex = new RegExp('_scaled_relative_skill$');
    if (relative_skill_regex.test(base_col_name(col_name))) {
        return 2;
    }
    const interval_coverage_regex = new RegExp('^interval_coverage_');
    if (!interval_coverage_regex.test(col_name) && values !== null) {
        return min_decimals_for_values(values);
    }
    return 1;
}

/**
 * Return the minimum number of decimal places needed so that every non-zero
 * value in `values` renders as non-zero (i.e., doesn't round to "0.000…0").
 * Null, undefined, non-finite, and zero entries are ignored.
 * Returns 1 when the array is empty or contains only zeros/non-finite values.
 *
 * @param {Array<number|null|undefined>} values
 * @returns {number}
 */
function min_decimals_for_values(values) {
    const nonZeroAbs = values
        .filter(v => v !== null && v !== undefined && isFinite(v) && v !== 0)
        .map(v => Math.abs(v));
    if (nonZeroAbs.length === 0) return 1;
    const minVal = Math.min(...nonZeroAbs);
    // ceil(-log10(minVal)) = decimal places needed to show 1 significant figure for the smallest value.
    // Subtract a tiny epsilon before ceil to guard against floating-point overshoot
    // (e.g. -log10(0.001) can return 2.9999... instead of 3 exactly).
    return Math.max(1, Math.ceil(-Math.log10(minVal) - 1e-10));
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
 * Does an in-place conversion of `data`'s score and 'n' columns' data types: Scores convert to floats, and 'n' to ints.
 *
 * @param disaggregateBy {String} - an `App.state.selected_disaggregate_by` value
 * @param data {Array} - as returned by _fetchData() - a d3.csv() object
 */
function convertDataColumnTypes(disaggregateBy, data) {
    const interval_coverage_regex = new RegExp('^interval_coverage_');
    for (const col_name of data.columns) {
        if (!['model_id', 'n', disaggregateBy].includes(col_name)) {
            // This is a score column, so convert values in all rows to float
            for (let i = 0; i < data.length; i++) {
                data[i][col_name] = parseFloat(data[i][col_name]);

                // If it's an interval coverage column, multiply by 100
                if (interval_coverage_regex.test(col_name)) {
                    data[i][col_name] *= 100;
                }
            }
        } else if (col_name === 'n') {
            // This is the 'n' column, so convert values in all rows to int
            for (let i = 0; i < data.length; i++) {
                data[i][col_name] = parseInt(data[i][col_name]);
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

export {titleCase, hexToRGB, min_decimals_for_values, get_round_decimals, parse_coverage_rate, split_transformed_col_name, base_col_name, convertDataColumnTypes, toArray}
