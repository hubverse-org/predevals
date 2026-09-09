import {
    base_col_name,
    convertDataColumnTypes,
    get_round_decimals,
    axis_kind,
    hexToRGB,
    is_coverage_col,
    is_n_col,
    is_relative_skill_col,
    render_score,
    parse_coverage_rate,
    reference_line_value,
    score_col_name_to_text,
    score_decimals,
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

test('with values: defers to score_decimals() for non-coverage, non-skill columns', assert => {
    assert.equal(get_round_decimals('wis', [0.000925, 0.000759, 0.000805]), 6);
    assert.equal(get_round_decimals('ae_median', [0.001, 0.002, 0.009]), 4);
    assert.equal(get_round_decimals('wis', [1.5, 2.3, 47.7]), 2);
});

test('with values: still returns 2 for scaled_relative_skill regardless of values', assert => {
    assert.equal(get_round_decimals('wis_scaled_relative_skill', [0.000925, 0.000759]), 2);
    assert.equal(get_round_decimals('mae_scaled_relative_skill', [100, 200]), 2);
});

test('with values: still returns 1 for interval_coverage columns (values are 0-100)', assert => {
    assert.equal(get_round_decimals('interval_coverage_50', [47.7, 93.3]), 1);
    assert.equal(get_round_decimals('interval_coverage_95', [0.001, 0.0005]), 1);
});


QUnit.module('score_decimals');

// The issue-88 regression case: flusight-dashboard `wis__log`, all 58 models. Every value sits in
// [0.19, 1.27], so the old min-anchored rule cleared its "nothing rounds to zero" bar at one
// decimal and rendered 21 of these 58 rows as the same "0.3".
const WIS_LOG_VALUES = [
    0.194580477360387, 0.42445635328479, 0.264657716265282, 0.343356886197072,
    0.305843546429542, 0.361738462099056, 0.460338093431164, 0.440443041113521,
    0.450465100085903, 0.565428319467, 0.265444756757736, 0.309846277585966,
    0.530184444278452, 0.327864650476597, 0.333704559479011, 0.311450841561445,
    0.322866070572885, 0.405768484358752, 0.431702079297883, 0.296765334110182,
    0.305707952027994, 0.690585048746816, 0.486658116642048, 0.575326737297091,
    0.581587036665746, 0.645718348925459, 0.704006487669316, 0.312369466300412,
    0.344182455268459, 0.415489242163702, 0.422157834149336, 0.381696816546922,
    0.404151084284733, 0.322012575547464, 0.345297308828633, 0.428431249029247,
    0.472023154530456, 0.311225672203621, 0.305893179663906, 0.392204368133479,
    0.384833937936552, 0.530086715037455, 0.643205272486554, 0.398985751470517,
    0.393277225697538, 0.30886209898577, 0.33910087296964, 1.27387287336059,
    0.482863143449645, 0.563085931347079, 0.465941529854746, 0.314563493121172,
    0.52361022830072, 0.459469976679847, 0.597800361636446, 0.408775489527314,
    0.296166723330344, 0.500871388446773,
];

test('returns 0 when there is nothing non-zero to resolve', assert => {
    assert.equal(score_decimals([]), 0);
    assert.equal(score_decimals([0, 0, 0]), 0);
    assert.equal(score_decimals([null, undefined]), 0);
    assert.equal(score_decimals([Infinity, -Infinity]), 0);
});

test('resolves the flusight `wis__log` column past one decimal (issue #88)', assert => {
    assert.equal(score_decimals(WIS_LOG_VALUES), 2, 'IQR of 0.161 resolves at 2 decimals');
});

test('whole-number-scale columns drop to 0 decimals', assert => {
    // national-scale MAE: every integer digit is kept, only the decimal place goes. A
    // significant-figure rule (R's signif) would render these as 1250, 12300 - this one does not
    const national = [1247.3, 1583.9, 2104.6, 2890.2, 3312.8, 4501.7, 5120.4, 8842.1, 12345.6, 15678.9];
    assert.equal(score_decimals(national), 0);
    assert.equal(render_score('ae_median', 12345.6, 0), '12346');
});

test('falls back to the range, then to sig figs, as the IQR degenerates', assert => {
    assert.equal(score_decimals([42.7]), 1, 'single value: 3 sig figs');
    assert.equal(score_decimals([5, 5, 5]), 2, 'all identical: IQR and range both zero');
});

test('one high outlier does not flatten the column', assert => {
    // the cap is anchored on Q3, not the max: anchoring on the max would give d_cap = 0 here and
    // render the nine rows that matter as "0", "1", "1", ...
    const withOutlier = [0.42, 0.55, 0.61, 0.73, 0.88, 1.02, 1.19, 1.41, 2.05, 52000];
    assert.equal(score_decimals(withOutlier), 2);
    assert.equal(render_score('wis', 0.42, 2), '0.42');
});

test('one low outlier does not pad the column with decimals', assert => {
    // min-anchoring - the old rule, and the `minSigFigs` floor considered on #88 - would force
    // decimals here to keep 0.05 visible, giving "183.70" and "392.80"
    const withOutlier = [0.05, 183.7, 220.4, 250.9, 290.7, 312.5, 392.8];
    assert.equal(score_decimals(withOutlier), 0);
    assert.equal(render_score('wis', 183.7, 0), '184');
});

test('guards floating-point overshoot at exact powers of ten', assert => {
    // log10(0.001) is -3.0000000000000004, which would floor to -4 without the epsilon
    assert.equal(score_decimals([0.001, 0.002, 0.009]), 4);
});

test('respects maxDecimals', assert => {
    assert.equal(score_decimals([0.000925, 0.000759, 0.000805]), 6, 'jointly binding with the spread');
    assert.equal(score_decimals([0.000925, 0.000759, 0.000805], {maxDecimals: 4}), 4);
});

test('ignores null, undefined, and non-finite entries', assert => {
    assert.equal(score_decimals([null, undefined, Infinity, -Infinity, 1.5, 2.3, 47.7]),
        score_decimals([1.5, 2.3, 47.7]));
});

test('counts zeros as observations when measuring the spread', assert => {
    // a zero is a real score, so it belongs in the column's distribution even though it can't
    // anchor a magnitude. Only the magnitude anchors skip it
    assert.equal(score_decimals([0, 1.5, 2.3, 47.7]), 1, 'the zero widens the IQR');
    assert.equal(score_decimals([1.5, 2.3, 47.7]), 2);
});


QUnit.module('render_score');

test('distinguishes `wis__log` values that all rendered as "0.3" (issue #88)', assert => {
    const decimals = score_decimals(WIS_LOG_VALUES);

    // the three rows visible in the issue screenshot
    assert.equal(render_score('wis__log', 0.265444756757736, decimals), '0.27');
    assert.equal(render_score('wis__log', 0.305843546429542, decimals), '0.31');
    assert.equal(render_score('wis__log', 0.296765334110182, decimals), '0.30');

    const rendered = WIS_LOG_VALUES.map(v => render_score('wis__log', v, decimals));
    assert.equal(WIS_LOG_VALUES.filter(v => v.toFixed(1) === '0.3').length, 21, 'rows the old rule flattened');
    assert.equal(new Set(rendered).size, 34, 'distinct strings, up from 7 under the old rule');
});

test('overrides the column decimals for skill and coverage columns', assert => {
    assert.equal(render_score('wis_scaled_relative_skill', 0.798407240258868, 0), '0.80');
    assert.equal(render_score('interval_coverage_50', 52.884615384615394, 0), '52.9');
});

test('flags values too small to survive the column rounding', assert => {
    assert.equal(render_score('wis', 0.0001, 2), '<0.01');
    assert.equal(render_score('wis', -0.0001, 2), '>-0.01');
    assert.equal(render_score('wis', 0.05, 0), '<1');
    assert.equal(render_score('wis', 0.005, 2), '0.01', 'rounds up rather than flagging');
    assert.equal(render_score('wis', 0, 2), '0.00', 'a true zero is not flagged');
});

test('renders missing and non-finite values as empty', assert => {
    assert.equal(render_score('wis', null, 2), '');
    assert.equal(render_score('wis', undefined, 2), '');
    assert.equal(render_score('wis', Infinity, 2), '');
    assert.equal(render_score('wis', NaN, 2), '');
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


QUnit.module('is_n_col');

test('matches the plain `n` column and per-output-type `n_<output_type>` columns', assert => {
    assert.true(is_n_col('n'));
    assert.true(is_n_col('n_quantile'));
    assert.true(is_n_col('n_mean'));
    assert.true(is_n_col('n_pmf'));
});

test('does not match metric, model_id, or disaggregate columns', assert => {
    assert.false(is_n_col('wis'));
    assert.false(is_n_col('ae_median'));
    assert.false(is_n_col('interval_coverage_50'));
    assert.false(is_n_col('model_id'));
    assert.false(is_n_col('nowcast'));  // starts with `n` but is neither `n` nor `n_...`
});


QUnit.module('is_coverage_col');

test('matches interval_coverage_* columns only', assert => {
    assert.true(is_coverage_col('interval_coverage_50'));
    assert.true(is_coverage_col('interval_coverage_95'));

    assert.false(is_coverage_col('wis'));
    assert.false(is_coverage_col('wis_scaled_relative_skill'));
    assert.false(is_coverage_col('n'));
    assert.false(is_coverage_col('model_id'));
    assert.false(is_coverage_col('my_interval_coverage_50'));  // not anchored at the start
});


QUnit.module('is_relative_skill_col');

test('matches *_scaled_relative_skill columns only', assert => {
    assert.true(is_relative_skill_col('wis_scaled_relative_skill'));
    assert.true(is_relative_skill_col('ae_median_scaled_relative_skill'));
    assert.true(is_relative_skill_col('ae_point_scaled_relative_skill'));
    assert.true(is_relative_skill_col('se_point_scaled_relative_skill'));

    // matched against the base metric, so a transformed-scale column counts
    assert.true(is_relative_skill_col('wis_scaled_relative_skill__log'));

    assert.false(is_relative_skill_col('wis'));
    assert.false(is_relative_skill_col('wis__log'));
    assert.false(is_relative_skill_col('interval_coverage_95'));
    assert.false(is_relative_skill_col('n'));
    assert.false(is_relative_skill_col('model_id'));

    // anchored at the end: the suffix has to close the base metric name
    assert.false(is_relative_skill_col('wis_scaled_relative_skill_pct'));
});


QUnit.module('reference_line_value');

test('coverage metrics reference their nominal level', assert => {
    // values are 0-100 percentages by the time they reach the plot (convertDataColumnTypes())
    assert.equal(reference_line_value('interval_coverage_50'), 50);
    assert.equal(reference_line_value('interval_coverage_95'), 95);
});

test('relative skill metrics reference the baseline at 1.0', assert => {
    assert.equal(reference_line_value('wis_scaled_relative_skill'), 1);
    assert.equal(reference_line_value('ae_median_scaled_relative_skill'), 1);
    assert.equal(reference_line_value('se_point_scaled_relative_skill'), 1);

    // the transform is applied to the scores before the pairwise comparison, so the baseline is
    // still exactly 1.0 on a transformed scale
    assert.equal(reference_line_value('wis_scaled_relative_skill__log'), 1);
});

test('metrics with no fixed reference get none', assert => {
    assert.strictEqual(reference_line_value('wis'), null);
    assert.strictEqual(reference_line_value('wis__log'), null);
    assert.strictEqual(reference_line_value('ae_median'), null);
    assert.strictEqual(reference_line_value('log_score'), null);
    assert.strictEqual(reference_line_value('rps'), null);
    assert.strictEqual(reference_line_value('n'), null);
});


QUnit.module('score_col_name_to_text');

test('renders scored-count columns (n / n_<output_type>) as N', assert => {
    assert.equal(score_col_name_to_text('n'), 'N');
    assert.equal(score_col_name_to_text('n_quantile'), 'N');
    assert.equal(score_col_name_to_text('n_mean'), 'N');
});

test('renders metrics, relative skill, and coverage columns', assert => {
    assert.equal(score_col_name_to_text('model_id'), 'Model');
    assert.equal(score_col_name_to_text('wis'), 'WIS');
    assert.equal(score_col_name_to_text('wis_scaled_relative_skill'), 'Rel. WIS');
    assert.equal(score_col_name_to_text('interval_coverage_95'), '95% Cov.');
});

test('renders transformed-scale columns with the label in parentheses', assert => {
    assert.equal(score_col_name_to_text('wis__log'), 'WIS (log)');
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

test('converts per-output-type n columns (n_<output_type>) to int', assert => {
    const data = [
        {model_id: 'm1', location: 'US', wis: '3.5', n_quantile: '10', ae_point: '2.1', n_mean: '20'},
        {model_id: 'm2', location: 'US', wis: '1.2', n_quantile: '30', ae_point: '0.9', n_mean: '40'},
    ];
    data.columns = ['model_id', 'location', 'wis', 'n_quantile', 'ae_point', 'n_mean'];
    convertDataColumnTypes('location', data);

    assert.strictEqual(data[0].n_quantile, 10);
    assert.strictEqual(data[1].n_quantile, 30);
    assert.strictEqual(data[0].n_mean, 20);
    assert.strictEqual(data[1].n_mean, 40);
    // score columns alongside them still convert to float
    assert.strictEqual(data[0].wis, 3.5);
    assert.strictEqual(data[0].ae_point, 2.1);
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


QUnit.module('axis_kind');

test('classifies ISO dates as date', assert => {
    assert.equal(axis_kind(['2025-01-06', '2025-01-13', '2025-01-20']), 'date');
});

test('classifies numbers as numeric, including negatives, zero, and decimals', assert => {
    assert.equal(axis_kind(['0', '1', '2', '3']), 'numeric');
    assert.equal(axis_kind(['-31', '-1', '0', '10']), 'numeric');
    assert.equal(axis_kind(['1.5', '2']), 'numeric');
});

test('falls back to category for anything else', assert => {
    assert.equal(axis_kind(['US', 'CA']), 'category');
    assert.equal(axis_kind(['1', '2', 'US']), 'category', 'mixed numeric and non-numeric');
    assert.equal(axis_kind(['2025-01-06', 'US']), 'category', 'mixed date and non-date');
    assert.equal(axis_kind(['1', '']), 'category', 'empty string is not a number');
    assert.equal(axis_kind([]), 'category', 'no values');
});

test('requires the whole value to be a date, not just its start', assert => {
    // Plotly renders a blank plot for a date axis whose values it cannot parse, so a labelled
    // date such as a task_id_text entry has to fall through to category
    assert.equal(axis_kind(['2025-01-06 (EW02)', '2025-01-13 (EW03)']), 'category');
    assert.equal(axis_kind(['2025-01-06/2025-01-12', '2025-01-13/2025-01-19']), 'category');
});
