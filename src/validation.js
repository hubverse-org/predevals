/**
 * Validates the `options` argument passed to `App.initialize()`. Throws a descriptive error string if invalid.
 *
 * @param {Object} options - predeval initialization options as documented in README.md
 * @throws {String} - descriptive error message if invalid
 */
function _validateOptions(options) {
    const errors = [];
    ['targets', 'eval_sets'].forEach(prop => {
        if (!(prop in options)) {
            errors.push(`missing required property: '${prop}'`);
        }
    });
    if (errors.length > 0) {
        throw `_validateOptions(): ${JSON.stringify(errors)}`;
    }
    if ('initial_sort_column' in options) {
        const colName = options['initial_sort_column'];
        if (typeof colName !== 'string') {
            throw `_validateOptions(): 'initial_sort_column' must be a string, got: ${typeof colName}`;
        }
        const validColNames = new Set(['model_id', 'n']);
        options['targets'].forEach(target => {
            (target.metrics || []).forEach(m => validColNames.add(m));
            (target.relative_metrics || []).forEach(m => validColNames.add(m));
        });
        if (!validColNames.has(colName)) {
            throw `_validateOptions(): 'initial_sort_column' '${colName}' is not a valid scores.csv column name. ` +
                `Valid names: ${JSON.stringify([...validColNames])}`;
        }
    }
}

export default _validateOptions;
