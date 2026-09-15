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

// `get_round_decimals()` is the per-column entry point the scores table calls once per column. It
// answers one question: does this column get a fixed decimal count, independent of the values, or
// should its precision be measured from the values in it? Relative skill (always 2 decimals) and
// coverage (always 1; the values are 0-100 percentages) are fixed. Every other metric column is
// measured, by `score_decimals()` below.

test('returns 1 for plain metric columns (no values)', assert => {
    // Case: a caller has the column name but not the column's values.
    // Desired: fall back to the fixed 1 decimal that predates issue #88. With no values in hand
    // there is no variation to measure, so the historical default stands.
    assert.equal(get_round_decimals('wis'), 1);
    assert.equal(get_round_decimals('mae'), 1);
    assert.equal(get_round_decimals('wis__log'), 1);
    assert.equal(get_round_decimals('interval_coverage_50'), 1);
});

test('returns 2 for scaled_relative_skill columns', assert => {
    // Case: a relative skill column, whose values are ratios centered on the 1.0 baseline.
    // Desired: always 2 decimals. The scale is fixed and known in advance, and "1.05 vs 0.98" is
    // the comparison readers make, so this column does not want the measured rule.
    assert.equal(get_round_decimals('wis_scaled_relative_skill'), 2);
    assert.equal(get_round_decimals('mae_scaled_relative_skill'), 2);
    assert.equal(get_round_decimals('mae_scaled_relative_skill__log'), 2);
});

test('with values: defers to score_decimals() for non-coverage, non-skill columns', assert => {
    // Case: an ordinary metric column with its values in hand - the normal scores-table path.
    // Desired: hand off to score_decimals(), so the decimals track each column's own variation. A
    // covidhub-scale WIS column needs 6 decimals; a column spanning 1.5 to 47.7 needs 2.
    assert.equal(get_round_decimals('wis', [0.000925, 0.000759, 0.000805]), 6);
    assert.equal(get_round_decimals('ae_median', [0.001, 0.002, 0.009]), 4);
    assert.equal(get_round_decimals('wis', [1.5, 2.3, 47.7]), 2);
});

test('with values: still returns 2 for scaled_relative_skill regardless of values', assert => {
    // Case: a relative skill column whose values the measured rule would read very differently -
    // near-zero ratios, or ratios in the hundreds.
    // Desired: the fixed 2 still wins. This column's decimal count does not depend on its values
    // at all, so a filtered-down set of rows can never change its width.
    assert.equal(get_round_decimals('wis_scaled_relative_skill', [0.000925, 0.000759]), 2);
    assert.equal(get_round_decimals('mae_scaled_relative_skill', [100, 200]), 2);
});

test('with values: still returns 1 for interval_coverage columns (values are 0-100)', assert => {
    // Case: a coverage column. convertDataColumnTypes() has already rescaled it to 0-100, so
    // the values are percentages; the 0-1 values in the second assertion are a shape that should
    // never reach here.
    // Desired: the fixed 1 decimal wins either way. "52.9" is the readable form of a coverage
    // rate, and the measured rule would otherwise pad the column out on odd inputs.
    assert.equal(get_round_decimals('interval_coverage_50', [47.7, 93.3]), 1);
    assert.equal(get_round_decimals('interval_coverage_95', [0.001, 0.0005]), 1);
});


QUnit.module('score_decimals');

// WHAT `score_decimals()` IS FOR, AND WHAT THE TESTS BELOW ASSERT
//
// It picks ONE decimal count for an entire score column, so every cell in the column prints with
// the same number of decimal places and the decimal points line up. The desired behavior, which
// the tests in this module pin down one rule at a time:
//
// 1. Resolve the comparison between models, not the precision of any single score. The reader's
//    question is "how do these models rank against each other", so the column carries enough
//    decimals to show roughly two digits of the SPREAD among the models. A column whose models all
//    sit between 0.19 and 1.27 has to separate them (2 decimals); a column whose models sit
//    between 1247 and 15679 does not need a decimal place at all (0).
// 2. Measure that spread between quantiles (Q1 to Q3), never between min and max, so that one
//    blown-up model cannot flatten the leaderboard and one near-zero model cannot pad every other
//    row with spurious decimals. The significant-figure cap is anchored on Q3 for the same reason.
// 3. Never round to the left of the decimal point. This is a decimals rule (`toFixed`), not a
//    significant-figures rule (R's `signif`, the alternative weighed on issue #88): a
//    national-scale MAE of 12345.6 prints as "12346", never as "12300".
// 4. Degrade in rungs rather than off a cliff when the IQR is zero (too few rows, or many tied
//    rows): widen Q1-Q3 to P10-P90, then to the full range, and only then fall back to 3
//    significant figures of a typical value. Each rung gives up a little outlier resistance, in
//    order, so the resistant answer is always tried first.
//
// One consequence to keep in mind while reading the expected numbers below: because the decimals
// are set by the spread, they can be one more than it takes to merely tell adjacent rows apart. A
// spread of 0.02 asks for 3 decimals, since two digits of that spread is "0.020" - not the 2
// decimals that distinguishing 0.50 from 0.52 would need on its own.

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
    // Case: a column with no non-zero finite value in it at all - no rows survived the
    // filters, or every score is zero, missing, or infinite.
    // Desired: 0 decimals. There is no magnitude to anchor on, so any decimal count would be
    // invented. 0 prints these cells as a plain "0" instead of implying a precision (0.00) that
    // nothing in the data supports.
    assert.equal(score_decimals([]), 0);
    assert.equal(score_decimals([0, 0, 0]), 0);
    assert.equal(score_decimals([null, undefined]), 0);
    assert.equal(score_decimals([Infinity, -Infinity]), 0);
});

test('resolves the flusight `wis__log` column past one decimal (issue #88)', assert => {
    // Case: the bug report itself. 58 flusight models, every wis__log score between 0.19 and
    // 1.27, with a Q1-Q3 spread of 0.161.
    // Desired: 2 decimals, so neighboring models stay distinguishable. The old rule asked only
    // "does any value round to zero at this width", cleared that bar at 1 decimal, and printed 21
    // of the 58 models as the identical string "0.3".
    assert.equal(score_decimals(WIS_LOG_VALUES), 2, 'IQR of 0.161 resolves at 2 decimals');
});

test('whole-number-scale columns drop to 0 decimals', assert => {
    // Case: a national-scale MAE column - values in the thousands, spread (Q1-Q3) about 3000.
    // Desired: 0 decimals. A tenth of a case is noise at this scale, so the decimal place goes -
    // but every integer digit stays, which is rule 3 above. R's signif() would have rendered these
    // as 1250 and 12300, discarding real information; a decimals rule cannot do that.
    const national = [1247.3, 1583.9, 2104.6, 2890.2, 3312.8, 4501.7, 5120.4, 8842.1, 12345.6, 15678.9];
    assert.equal(score_decimals(national), 0);
    assert.equal(render_score('ae_median', 12345.6, 0), '12346');
});

test('widens the quantile window, then falls back to sig figs, as the IQR degenerates', assert => {
    // Case: columns with no measurable spread anywhere - a single row, or every row tied. No
    // comparison is being made, so there is nothing for rule 1 to resolve.
    // Desired: the last rung, 3 significant figures of a typical value, which is a reasonable
    // default for a number about which nothing else is known: 42.7 keeps its tenth, and 5 prints
    // as "5.00".
    assert.equal(score_decimals([42.7]), 1, 'single value: 3 sig figs');
    assert.equal(score_decimals([5, 5, 5]), 2, 'all identical: every window is zero-width');
});

test('a tie-heavy column is not handed back to its outlier', assert => {
    // Case: nine models effectively tied around 0.5 (one of them at 0.52) and one model that
    // blew up at 52000. Q1 and Q3 are both 0.5, so the IQR is zero and the rule has to widen.
    // Desired: 3 decimals, measured from the P10-P90 spread of 0.02, so the tied models stay
    // legible as "0.500" and "0.520". That is one decimal more than telling 0.50 from 0.52 needs:
    // the rule shows two digits of the spread itself ("0.020"), per rule 1 above.
    // Why P10-P90 and not the full range: the range here is 52000, which yields 0 decimals and
    // prints the nine models that matter as "1" nine times over - exactly the issue-88 failure,
    // one fallback rung later.
    const tied = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.52, 52000];
    assert.equal(score_decimals(tied), 3);
    assert.equal(render_score('wis', 0.5, 3), '0.500');
    assert.equal(render_score('wis', 0.52, 3), '0.520');

    // Case: tied past P10-P90 as well, so even the widened window measures nothing.
    // Desired: fall to the next rung, the full range, which is the last thing left to measure. It
    // gives 0 decimals here, which is also the right answer for a column that really is nine 1s
    // and one 1000.
    assert.equal(score_decimals([1, 1, 1, 1, 1, 1, 1, 1, 1, 1000]), 0);
});

test('one high outlier does not flatten the column', assert => {
    // Case: an ordinary leaderboard (0.42 to 2.05) with one model that blew up at 52000 - the
    // common real-world shape, and the one rule 2 exists for.
    // Desired: 2 decimals, set by the contenders. Both anchors ignore the outlier: the spread is
    // Q1-Q3 (0.58), and the significant-figure cap is anchored on Q3 (1.19). Anchoring the cap on
    // the max instead would give 0 decimals and print the nine models that matter as "0", "1",
    // "1", ...
    const withOutlier = [0.42, 0.55, 0.61, 0.73, 0.88, 1.02, 1.19, 1.41, 2.05, 52000];
    assert.equal(score_decimals(withOutlier), 2);
    assert.equal(render_score('wis', 0.42, 2), '0.42');
});

test('one low outlier does not pad the column with decimals', assert => {
    // Case: the mirror image - a column in the hundreds with one model scoring 0.05.
    // Desired: 0 decimals, again set by the contenders (Q1-Q3 is 107). Min-anchoring - the old
    // rule, and the `minSigFigs` floor weighed on issue #88 - would keep 0.05 visible by giving
    // every other row two decimals it cannot support: "183.70", "392.80". The 0.05 row instead
    // renders as "<1" (see render_score below), which is how the column stays honest about that
    // model without taxing all the others.
    const withOutlier = [0.05, 183.7, 220.4, 250.9, 290.7, 312.5, 392.8];
    assert.equal(score_decimals(withOutlier), 0);
    assert.equal(render_score('wis', 183.7, 0), '184');
});

test('guards floating-point overshoot at exact powers of ten', assert => {
    // Case: a spread that lands on an exact power of ten (0.002 - 0.001 = 0.001).
    // Desired: 4 decimals. This is a numerical guard rather than a display policy: log10(0.001)
    // evaluates to -3.0000000000000004, which floors to -4 and would hand the column a spurious
    // fifth decimal were it not for the epsilon in mag().
    assert.equal(score_decimals([0.001, 0.002, 0.009]), 4);
});

test('resolves the covidhub tiny-WIS column (issue #48 fixture)', assert => {
    // Case: real covidhub data - an entire WIS column down at 1e-3, spread 1.7e-4.
    // Desired: enough decimals that no two models collapse onto the same string, which for this
    // column is 5. The Set assertion at the end is the requirement; the 5 is just what meets it.
    // The old min-anchored rule stopped at 4 and printed both 0.000805 and 0.000759 as "0.0008".
    const wisValues = [0.000925048661683814, 0.00075907107176393, 0.000804968609706757,
        0.00138310730984419, 0.00143697666395866, 0.00055223613252158, 0.000892415568463205];
    assert.equal(score_decimals(wisValues), 5);

    const rendered = wisValues.map(v => render_score('wis', v, 5));
    assert.deepEqual(rendered,
        ['0.00093', '0.00076', '0.00080', '0.00138', '0.00144', '0.00055', '0.00089']);
    assert.equal(new Set(rendered).size, wisValues.length, 'no two rows collapse onto one string');
});

test('respects maxDecimals', assert => {
    // Case: a column so tightly spread (4.6e-5) that resolving it asks for more decimals than
    // a table cell can usefully show.
    // Desired: the measured spread governs until it reaches maxDecimals (6 by default), and then
    // maxDecimals governs. It is a hard ceiling on the column's width, not a suggestion.
    assert.equal(score_decimals([0.000925, 0.000759, 0.000805]), 6, 'jointly binding with the spread');
    assert.equal(score_decimals([0.000925, 0.000759, 0.000805], {maxDecimals: 4}), 4);
});

test('ignores null, undefined, and non-finite entries', assert => {
    // Case: a column with holes - models missing a score for this target, or an infinite one.
    // Desired: those entries take no part in the decision. The column's width is exactly what the
    // finite values alone would have produced.
    assert.equal(score_decimals([null, undefined, Infinity, -Infinity, 1.5, 2.3, 47.7]),
        score_decimals([1.5, 2.3, 47.7]));
});

test('counts zeros as observations when measuring the spread', assert => {
    // Case: a column holding a genuine 0.0 score alongside ordinary values.
    // Desired: the zero counts as a row when measuring the spread - it widens Q1-Q3 from 0.8 to
    // 2.3 here, which takes the column from 2 decimals down to 1 - but it is skipped when picking
    // the typical magnitude for the significant-figure cap, since log10(0) is not a magnitude. A
    // zero is a real score and belongs in the column's distribution; it just cannot anchor one.
    assert.equal(score_decimals([0, 1.5, 2.3, 47.7]), 1, 'the zero widens the IQR');
    assert.equal(score_decimals([1.5, 2.3, 47.7]), 2);
});


QUnit.module('render_score');

// `render_score()` turns one value into the string for one cell, given the decimals that
// get_round_decimals() chose for the whole column. Its three jobs, one per test below: apply the
// fixed decimal counts for skill and coverage columns; never let the column-wide rounding claim
// that a real non-zero score is zero (the "<0.01" form); and render absent data as an empty cell.

test('distinguishes `wis__log` values that all rendered as "0.3" (issue #88)', assert => {
    // Case: the issue-88 column once more, this time end to end - decimals from score_decimals(),
    // strings from render_score().
    // Desired: the three rows visible in the issue screenshot print as three different numbers,
    // and the column as a whole resolves into 34 distinct strings where the old rule produced 7.
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
    // Case: a caller passes decimals of 0 for a skill or coverage column.
    // Desired: render_score() ignores the argument and applies the fixed decimal count anyway - 2
    // for skill, 1 for coverage. These columns are pinned here as well as in get_round_decimals(),
    // so no caller can accidentally unpin them.
    assert.equal(render_score('wis_scaled_relative_skill', 0.798407240258868, 0), '0.80');
    assert.equal(render_score('interval_coverage_50', 52.884615384615394, 0), '52.9');
});

test('flags values too small to survive the column rounding', assert => {
    // Case: a column rounded to 2 decimals contains a score of 0.0001 - a real, non-zero
    // result that toFixed(2) would print as "0.00".
    // Desired: "<0.01" instead, so the reader sees "smaller than this column can show" rather than
    // a claim that the model scored zero. This is what makes the outlier-resistant anchors safe: a
    // low outlier loses its digits but not its meaning. A value that rounds up to a visible digit
    // prints normally, and a true zero is not flagged, because it really is zero.
    assert.equal(render_score('wis', 0.0001, 2), '<0.01');
    assert.equal(render_score('wis', -0.0001, 2), '>-0.01');
    assert.equal(render_score('wis', 0.05, 0), '<1');
    assert.equal(render_score('wis', 0.005, 2), '0.01', 'rounds up rather than flagging');
    assert.equal(render_score('wis', 0, 2), '0.00', 'a true zero is not flagged');
});

test('renders missing and non-finite values as empty', assert => {
    // Case: a model with no score for this cell, or a non-finite one.
    // Desired: an empty cell. "NaN" or "Infinity" sitting in a leaderboard reads as if it were a
    // scoring result.
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
