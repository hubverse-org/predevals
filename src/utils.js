function titleCase(str) {  // per https://stackoverflow.com/questions/196972/convert-string-to-title-case-with-javascript
    return str.toLowerCase().replace(/\b\w/g, s => s.toUpperCase());
}

function toLowerCaseIfString(input) {
    if (typeof input === 'string') {
        return input.toLowerCase();
    } else {
        return input;
    }
}

function hexToRGB(hex) {
    let r = parseInt(hex.substring(1, 3), 16);
    let g = parseInt(hex.substring(3, 5), 16);
    let b = parseInt(hex.substring(5, 7), 16);
    return `rgb(${r}, ${g}, ${b})`;
}

function get_round_decimals(col_name) {
    const relative_skill_regex = new RegExp('_scaled_relative_skill$');
    if (relative_skill_regex.test(col_name)) {
        return 2;
    } else {
        return 1;
    }
}

function parse_coverage_rate(score_name) {
    return parseFloat(score_name.slice(18));
}

/**
 * Does an in-place conversion of `data`'s score and 'n' columns' data types: Scores convert to floats, and 'n' to ints.
 *
 * @param disaggregateBy {String} - an `App.state.selected_disaggregate_by` value
 * @param data {array} - as returned by _fetchData() - a d3.csv() object
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

export {titleCase, toLowerCaseIfString, hexToRGB, get_round_decimals, parse_coverage_rate, convertDataColumnTypes}
