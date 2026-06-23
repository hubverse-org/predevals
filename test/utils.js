import {
    titleCase,
    hexToRGB,
    get_round_decimals,
    parse_coverage_rate,
    split_transformed_col_name,
    base_col_name,
    convertDataColumnTypes,
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

test('hexToRGB() expands 3-char shorthand hex', assert => {
    assert.equal(hexToRGB('#fff'), 'rgb(255, 255, 255)');
    assert.equal(hexToRGB('#f00'), 'rgb(255, 0, 0)');
    assert.equal(hexToRGB('#0f0'), 'rgb(0, 255, 0)');
});


QUnit.module('get_round_decimals');

test('returns 1 for plain metric columns', assert => {
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


QUnit.module('parse_coverage_rate');

test('parse_coverage_rate()', assert => {
    assert.equal(parse_coverage_rate('interval_coverage_50'), 50);
    assert.equal(parse_coverage_rate('interval_coverage_95'), 95);
    assert.equal(parse_coverage_rate('interval_coverage_0.1'), 0.1);
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
