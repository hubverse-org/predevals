import {
    base_col_name,
    convertDataColumnTypes,
    get_round_decimals,
    hexToRGB,
    min_decimals_for_values,
    parse_coverage_rate,
    split_transformed_col_name,
    titleCase,
    toArray,
} from '../src/utils.js';

const {test} = QUnit;


//
// utils tests
//

QUnit.module('titleCase');

test('titleCase()', assert => {
    assert.equal(titleCase('hello world'), 'Hello World');
    assert.equal(titleCase('HELLO WORLD'), 'Hello World');
    assert.equal(titleCase('hello'), 'Hello');
    assert.equal(titleCase('already Title Case'), 'Already Title Case');
});


QUnit.module('hexToRGB');

test('hexToRGB() handles 6-char hex', assert => {
    assert.equal(hexToRGB('#ff0000'), 'rgb(255, 0, 0)');
    assert.equal(hexToRGB('#000000'), 'rgb(0, 0, 0)');
    assert.equal(hexToRGB('#ffffff'), 'rgb(255, 255, 255)');
    assert.equal(hexToRGB('#1a2b3c'), 'rgb(26, 43, 60)');
});


QUnit.module('get_round_decimals');

test('returns 1 for plain metric columns (no values)', assert => {
    assert.equal(get_round_decimals('wis'), 1);
    assert.equal(get_round_decimals('mae'), 1);
    assert.equal(get_round_decimals('wis__log'), 1);
    assert.equal(get_round_decimals('interval_coverage_50'), 1);
});

test('returns 2 for scaled_relative_skill columns', assert => {
    assert.equal(get_round_decimals('wis_scaled_relative_skill'), 2);
    assert.equal(get_round_decimals('mae_scaled_relative_skill'), 2);
    assert.equal(get_round_decimals('mae_scaled_relative_skill__log'), 2);
});

test('with values: returns min decimals needed for non-coverage, non-skill columns', assert => {
    assert.equal(get_round_decimals('wis', [0.000925, 0.000759, 0.000805]), 4);
    assert.equal(get_round_decimals('ae_median', [0.001, 0.002, 0.009]), 3);
    assert.equal(get_round_decimals('wis', [1.5, 2.3, 47.7]), 1);
});

test('with values: still returns 2 for scaled_relative_skill regardless of values', assert => {
    assert.equal(get_round_decimals('wis_scaled_relative_skill', [0.000925, 0.000759]), 2);
    assert.equal(get_round_decimals('mae_scaled_relative_skill', [100, 200]), 2);
});

test('with values: still returns 1 for interval_coverage columns (values are 0-100)', assert => {
    assert.equal(get_round_decimals('interval_coverage_50', [47.7, 93.3]), 1);
    assert.equal(get_round_decimals('interval_coverage_95', [0.001, 0.0005]), 1);
});


QUnit.module('min_decimals_for_values');

test('returns 1 for empty, all-zero, or all-non-finite values', assert => {
    assert.equal(min_decimals_for_values([]), 1);
    assert.equal(min_decimals_for_values([0, 0, 0]), 1);
    assert.equal(min_decimals_for_values([null, undefined]), 1);
    assert.equal(min_decimals_for_values([Infinity, -Infinity]), 1);
});

test('returns 1 for values >= 0.1', assert => {
    assert.equal(min_decimals_for_values([1.5, 2.3, 47.7]), 1);
    assert.equal(min_decimals_for_values([0.1, 0.5, 0.9]), 1);
});

test('returns 2 for values in [0.01, 0.1)', assert => {
    assert.equal(min_decimals_for_values([0.05, 0.08]), 2);
    assert.equal(min_decimals_for_values([0.01, 0.09]), 2);
});

test('returns 3 for values in [0.001, 0.01)', assert => {
    assert.equal(min_decimals_for_values([0.005, 0.008]), 3);
    assert.equal(min_decimals_for_values([0.001, 0.009]), 3);
});

test('returns 4 for covidhub-style WIS values (~0.0005-0.0014)', assert => {
    // real data: document.predevals.state.scores_table wis column
    const wisValues = [0.000925048661683814, 0.00075907107176393, 0.000804968609706757,
        0.00138310730984419, 0.00143697666395866, 0.00055223613252158, 0.000892415568463205];
    assert.equal(min_decimals_for_values(wisValues), 4);
});

test('is driven by the smallest non-zero absolute value in the array', assert => {
    assert.equal(min_decimals_for_values([100, 1.5, 0.001]), 3);
});

test('handles negative values by taking absolute value', assert => {
    assert.equal(min_decimals_for_values([-0.005, -0.008]), 3);
    assert.equal(min_decimals_for_values([-1.5, 0.5]), 1);
});

test('filters out null, undefined, and non-finite values', assert => {
    assert.equal(min_decimals_for_values([null, undefined, Infinity, -Infinity, 0, 0.5]), 1);
    assert.equal(min_decimals_for_values([null, 0.005]), 3);
});


QUnit.module('parse_coverage_rate');

test('parse_coverage_rate()', assert => {
    assert.equal(parse_coverage_rate('interval_coverage_50'), 50);
    assert.equal(parse_coverage_rate('interval_coverage_95'), 95);
});


QUnit.module('split_transformed_col_name');

test('returns null for plain column names', assert => {
    assert.strictEqual(split_transformed_col_name('wis'), null);
    assert.strictEqual(split_transformed_col_name('mae_scaled_relative_skill'), null);
});

test('returns base and label for transformed column names', assert => {
    assert.deepEqual(split_transformed_col_name('wis__log'), {base: 'wis', label: 'log'});
    assert.deepEqual(split_transformed_col_name('mae__sqrt'), {base: 'mae', label: 'sqrt'});
    assert.deepEqual(split_transformed_col_name('mae_scaled_relative_skill__log'), {
        base: 'mae_scaled_relative_skill',
        label: 'log',
    });
});

test('splits on first __ only', assert => {
    assert.deepEqual(split_transformed_col_name('a__b__c'), {base: 'a', label: 'b__c'});
});


QUnit.module('base_col_name');

test('returns input unchanged for plain column names', assert => {
    assert.equal(base_col_name('wis'), 'wis');
    assert.equal(base_col_name('mae_scaled_relative_skill'), 'mae_scaled_relative_skill');
});

test('returns the part before __ for transformed column names', assert => {
    assert.equal(base_col_name('wis__log'), 'wis');
    assert.equal(base_col_name('mae_scaled_relative_skill__log'), 'mae_scaled_relative_skill');
});


QUnit.module('convertDataColumnTypes');

test('converts score columns to float, n to int, interval_coverage to percent', assert => {
    const data = [
        {model_id: 'm1', location: 'US', n: '10', wis: '3.5', interval_coverage_50: '0.6'},
        {model_id: 'm2', location: 'US', n: '20', wis: '1.2', interval_coverage_50: '0.8'},
    ];
    data.columns = ['model_id', 'location', 'n', 'wis', 'interval_coverage_50'];
    convertDataColumnTypes('location', data);

    assert.strictEqual(data[0].wis, 3.5);
    assert.strictEqual(data[1].wis, 1.2);
    assert.strictEqual(data[0].n, 10);
    assert.strictEqual(data[1].n, 20);
    assert.strictEqual(data[0].interval_coverage_50, 60);
    assert.strictEqual(data[1].interval_coverage_50, 80);
});

test('converts scaled_relative_skill and transformed columns to float', assert => {
    const data = [
        {
            model_id: 'm1', location: 'US', n: '5',
            wis_scaled_relative_skill: '1.23',
            mae_scaled_relative_skill: '0.75',
            wis__log: '0.45',
            mae__sqrt: '1.10',
        },
    ];
    data.columns = ['model_id', 'location', 'n', 'wis_scaled_relative_skill', 'mae_scaled_relative_skill', 'wis__log', 'mae__sqrt'];
    convertDataColumnTypes('location', data);

    assert.strictEqual(data[0].wis_scaled_relative_skill, 1.23);
    assert.strictEqual(data[0].mae_scaled_relative_skill, 0.75);
    assert.strictEqual(data[0].wis__log, 0.45);
    assert.strictEqual(data[0].mae__sqrt, 1.10);
});

test('interval_coverage boundary values: 0 becomes 0, 1 becomes 100', assert => {
    const data = [
        {model_id: 'm1', location: 'US', n: '3', interval_coverage_50: '0', interval_coverage_95: '1'},
    ];
    data.columns = ['model_id', 'location', 'n', 'interval_coverage_50', 'interval_coverage_95'];
    convertDataColumnTypes('location', data);

    assert.strictEqual(data[0].interval_coverage_50, 0);
    assert.strictEqual(data[0].interval_coverage_95, 100);
});

test('leaves model_id and disaggregateBy columns unchanged', assert => {
    const data = [{model_id: 'm1', location: 'US', n: '5', wis: '2.0'}];
    data.columns = ['model_id', 'location', 'n', 'wis'];
    convertDataColumnTypes('location', data);

    assert.strictEqual(data[0].model_id, 'm1');
    assert.strictEqual(data[0].location, 'US');
});


QUnit.module('toArray');

test('returns empty array for null and undefined', assert => {
    assert.deepEqual(toArray(null), []);
    assert.deepEqual(toArray(undefined), []);
});

test('wraps a scalar in an array', assert => {
    assert.deepEqual(toArray('foo'), ['foo']);
    assert.deepEqual(toArray(42), [42]);
});

test('returns an array unchanged', assert => {
    assert.deepEqual(toArray(['foo', 'bar']), ['foo', 'bar']);
    assert.deepEqual(toArray([]), []);
});
