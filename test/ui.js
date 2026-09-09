import './stubs.js'
import App from '../src/predevals.js';

const {test} = QUnit;


//
// a self-contained options object to work with. Inlined (rather than read from dev-example/predevals-options.json) so
// these tests don't break when that fixture is regenerated/reordered, and mirroring predtimechart's ui.js, which
// inlines its options literal. Both targets carry a target_name; the second test deletes them to exercise the target_id
// fallback.
//
const TEST_OPTIONS = {
    targets: [
        {
            target_id: 'wk inc flu hosp',
            target_name: 'incident influenza hospitalizations',
            metrics: ['wis', 'ae_median'],
            relative_metrics: ['wis'],
            disaggregate_by: ['location', 'horizon'],
        },
        {
            target_id: 'wk inc flu death',
            target_name: 'incident influenza deaths',
            metrics: ['wis'],
            relative_metrics: ['wis'],
            disaggregate_by: ['location'],
        },
    ],
    eval_sets: [
        {eval_set_name: 'All rounds'},
    ],
    task_id_text: {location: {US: 'United States'}},
};


//
// initialize() function placeholder
//

function _fetchData(...args) {
}


//
// shared test helpers
//

// Register beforeEach/afterEach that neutralize initialize()'s data fetch (restored afterEach so the
// shared App singleton isn't left patched) and initialize a fresh App on the qunit-fixture.
function useStubbedApp(hooks) {
    let originalFetchDataUpdateDisplay;
    hooks.beforeEach(() => {
        originalFetchDataUpdateDisplay = App.fetchDataUpdateDisplay;
        App.fetchDataUpdateDisplay = function () {
        };
        App.initialize('qunit-fixture', _fetchData, structuredClone(TEST_OPTIONS));
        // initialize() doesn't reset the fetched scores, so clear them (they leak across tests via
        // the App singleton) to keep tests order-independent — a fresh load has fetched nothing.
        App.state.scores_table = [];
        App.state.scores_plot = [];
    });
    hooks.afterEach(() => {
        App.fetchDataUpdateDisplay = originalFetchDataUpdateDisplay;
    });
}

// DataTables isn't loaded in the jsdom test env; stub the pieces updateTable() touches so the
// <thead> is still assembled (that DOM is built before the DataTable() hand-off). Returns a getter
// for the config updateTable() handed over, which is where the column render functions live.
function stubDataTable(hooks) {
    let originalDataTable;
    let capturedConfig;
    hooks.beforeEach(() => {
        originalDataTable = $.fn.DataTable;
        capturedConfig = null;
        const DataTableStub = function (config) {
            capturedConfig = config;
            return {destroy() {}};
        };
        DataTableStub.isDataTable = function () {
            return false;
        };
        $.fn.DataTable = DataTableStub;
    });
    hooks.afterEach(() => {
        $.fn.DataTable = originalDataTable;
    });
    return () => capturedConfig;
}

// A scores_table stand-in carrying only the `.columns` property the render paths read.
function scoresWithColumns(columns) {
    const scores = [];
    scores.columns = columns;
    return scores;
}

// Collect the textContent of every element matching `selector`.
function textsOf(selector) {
    return [...document.querySelectorAll(selector)].map((el) => el.textContent);
}


//
// target <SELECT> tests
//

QUnit.module('target <SELECT>', (hooks) => {
    let originalFetchDataUpdateDisplay;

    hooks.beforeEach(() => {
        // prevent initialize() from fetching score data; restored afterEach so the shared App singleton isn't left
        // patched for any other test
        originalFetchDataUpdateDisplay = App.fetchDataUpdateDisplay;
        App.fetchDataUpdateDisplay = function (...args) {
        };
    });

    hooks.afterEach(() => {
        App.fetchDataUpdateDisplay = originalFetchDataUpdateDisplay;
    });

    test('initializeTargetUI() uses target_name as option text when present', assert => {
        const optionsCopy = structuredClone(TEST_OPTIONS);
        assert.expect(1 + optionsCopy.targets.length * 2);  // guards against an empty targets array
        App.initialize('qunit-fixture', _fetchData, optionsCopy);

        const options = [...document.getElementById('predeval_target').options];

        // one <option> per target, in order
        assert.equal(options.length, optionsCopy.targets.length);

        // value is always target_id; text is the human-readable target_name
        optionsCopy.targets.forEach((target, idx) => {
            assert.equal(options[idx].value, target.target_id);
            assert.equal(options[idx].text, target.target_name);
        });
    });

    test('initializeTargetUI() falls back to target_id when target_name is absent', assert => {
        // remove target_name from every target to simulate options without it
        const optionsCopy = structuredClone(TEST_OPTIONS);
        optionsCopy.targets.forEach((target) => delete target.target_name);
        assert.expect(1 + optionsCopy.targets.length * 2);
        App.initialize('qunit-fixture', _fetchData, optionsCopy);

        const options = [...document.getElementById('predeval_target').options];

        assert.equal(options.length, optionsCopy.targets.length);

        // with no target_name, both value and text fall back to target_id
        optionsCopy.targets.forEach((target, idx) => {
            assert.equal(options[idx].value, target.target_id);
            assert.equal(options[idx].text, target.target_id);
        });
    });
});


//
// glossary (Metric Definitions panel) tests
//

QUnit.module('metric definitions glossary', (hooks) => {
    useStubbedApp(hooks);

    const glossaryTerms = () => textsOf('#predeval_glossary_list dt');
    const glossaryDefinitions = () => textsOf('#predeval_glossary_list dd');

    test('adds an N definition when a single `n` column is present (table context)', assert => {
        App.state.scores_table = scoresWithColumns(['model_id', 'wis', 'ae_median', 'n']);
        App.updateGlossary();

        const terms = glossaryTerms();
        assert.true(terms.includes('N'), 'N term present');
        assert.equal(terms[terms.length - 1], 'N', 'N is listed last, after the metrics');

        const nIdx = terms.indexOf('N');
        assert.equal(glossaryDefinitions()[nIdx], 'Number of predictions scored for the associated metric(s).');
    });

    test('N definition clarifies left-association when multiple `n` columns are present', assert => {
        App.state.scores_table = scoresWithColumns(['model_id', 'wis', 'n_quantile', 'ae_point', 'n_mean']);
        App.updateGlossary();

        const terms = glossaryTerms();
        assert.true(terms.includes('N'), 'N term present');

        const nIdx = terms.indexOf('N');
        assert.true(
            glossaryDefinitions()[nIdx].includes('Each N count refers to the metric column(s) to its left.'),
            'multi-`n` clarification present');
    });

    test('updateDisplay() refreshes the glossary so the N entry appears once data has loaded', assert => {
        // Regression guard for the load-path gap: the N entry is derived from the fetched
        // scores_table, and updateGlossary() during initialize() runs before the fetch. Only
        // updateDisplay() (invoked after the fetch resolves) can populate it. updateTable()/
        // updatePlot() need DataTables/Plotly internals absent from this jsdom env, so stub them
        // out — we only assert that updateDisplay() wires through to the glossary.
        const origTable = App.updateTable;
        const origPlot = App.updatePlot;
        App.updateTable = function () {
        };
        App.updatePlot = function () {
        };
        try {
            // fresh-load state (scores_table cleared in beforeEach): glossary built without an N entry
            App.updateGlossary();
            assert.false(glossaryTerms().includes('N'), 'no N before data loads');

            // the fetch resolves and the post-fetch display refresh runs
            App.state.scores_table = scoresWithColumns(['model_id', 'wis', 'n']);
            App.updateDisplay();

            assert.true(glossaryTerms().includes('N'), 'N present after updateDisplay()');
        } finally {
            App.updateTable = origTable;
            App.updatePlot = origPlot;
        }
    });

    test('no N definition in plot context', assert => {
        App.state.scores_table = scoresWithColumns(['model_id', 'wis', 'n']);
        // switch to the plot tab so updateGlossary() uses the plot-context branch
        document.getElementById('predeval_plot_tab').classList.add('active');
        document.getElementById('predeval_table_tab').classList.remove('active');
        App.updateGlossary();

        assert.false(glossaryTerms().includes('N'), 'N absent in plot context');
    });
});


//
// scores table header rendering tests
//

QUnit.module('scores table headers', (hooks) => {
    useStubbedApp(hooks);
    stubDataTable(hooks);

    const headerTexts = () => textsOf('#predeval_table thead th');

    test('renders each n_<output_type> column as an `N` header, in column order', assert => {
        // divergent counts: n_quantile sits right of every quantile metric (WIS + interval coverage),
        // n_mean right of the mean point metric (se_point / MSE, the metric hubEvals uses for the
        // mean output type per Gneiting 2011)
        App.state.scores_table = scoresWithColumns([
            'model_id',
            'wis_scaled_relative_skill', 'wis', 'interval_coverage_50', 'interval_coverage_95', 'n_quantile',
            'se_point_scaled_relative_skill', 'se_point', 'n_mean',
        ]);
        App.updateTable();

        assert.deepEqual(
            headerTexts(),
            ['Model', 'Rel. WIS', 'WIS', '50% Cov.', '95% Cov.', 'N', 'Rel. MSE', 'MSE', 'N'],
            'each n_<output_type> renders as N immediately right of the metric group it counts');
        assert.equal(headerTexts().filter((t) => t === 'N').length, 2, 'two distinct N headers in the multi-n case');
    });

    test('renders the common single-n column as one `N` header', assert => {
        App.state.scores_table = scoresWithColumns(['model_id', 'wis', 'ae_median', 'n']);
        App.updateTable();

        assert.deepEqual(headerTexts(), ['Model', 'WIS', 'MAE', 'N']);
    });
});


//
// scores table cell rendering tests
//

QUnit.module('scores table cell rendering', (hooks) => {
    useStubbedApp(hooks);
    const dtConfig = stubDataTable(hooks);

    // the flusight `wis__log` column from issue #88, trimmed to the rows that make the point: under
    // the old min-anchored rule every one of these rendered as "0.3"
    const WIS_LOG_ROWS = [0.265444756757736, 0.305843546429542, 0.296765334110182, 0.194580477360387,
        0.42445635328479, 0.690585048746816, 1.27387287336059, 0.343356886197072];

    // Build a scores_table of real rows (not the header-only `scoresWithColumns` stand-in) so the
    // column-values → decimals → cell-string path runs for real.
    function tableWith(columnValues) {
        const columns = ['model_id', ...Object.keys(columnValues)];
        const nRows = Object.values(columnValues)[0].length;
        const scores = Array.from({length: nRows}, (_, i) => {
            const row = {model_id: `model-${i}`};
            for (const [col, values] of Object.entries(columnValues)) {
                row[col] = values[i];
            }
            return row;
        });
        scores.columns = columns;
        return scores;
    }

    const renderFor = (columnName) => dtConfig().columns.find((c) => c.name === columnName).render;

    test('renders score cells at the decimals that resolve the column (issue #88)', assert => {
        App.state.scores_table = tableWith({wis__log: WIS_LOG_ROWS});
        App.updateTable();

        const render = renderFor('wis__log');
        assert.equal(render(0.265444756757736, 'display'), '0.27');
        assert.equal(render(0.305843546429542, 'display'), '0.31');
        assert.equal(render(0.296765334110182, 'display'), '0.30');
    });

    test('hands DataTables the raw number for sorting', assert => {
        // render() runs for every DataTables type, and '<0.01' in a sort key would silently switch
        // the column to lexicographic ordering
        App.state.scores_table = tableWith({wis__log: WIS_LOG_ROWS});
        App.updateTable();

        const render = renderFor('wis__log');
        assert.strictEqual(render(0.305843546429542, 'sort'), 0.305843546429542);
        assert.strictEqual(render(0.305843546429542, 'type'), 0.305843546429542);
        assert.equal(render(0.305843546429542, 'filter'), '0.31', 'search matches what is displayed');
    });

    test('renders whole-number-scale columns without a decimal place', assert => {
        App.state.scores_table = tableWith({ae_median: [290.690197703552, 101.287927350427, 76.9, 498.2, 11.3]});
        App.updateTable();

        const render = renderFor('ae_median');
        assert.equal(render(290.690197703552, 'display'), '291');
        assert.equal(render(11.3, 'display'), '11');
    });
});

//
// plot x-axis tests
//

QUnit.module('plot x-axis', (hooks) => {
    useStubbedApp(hooks);

    // Populate scores_plot with one row per (model, x value), as the CSV fetch would. Values are
    // strings there, which is what makes the sort and axis-type handling matter.
    function setPlotScores(disaggregateBy, xValues) {
        App.state.selected_plot_type = 'Line plot';
        App.state.selected_metric = 'wis';
        App.state.selected_disaggregate_by = disaggregateBy;
        App.state.scores_plot = xValues.map((x) => ({
            model_id: 'model-a',
            [disaggregateBy]: String(x),
        }));
    }

    test('setXaxisValues() orders numeric task id values numerically, not lexicographically', assert => {
        // variant-nowcast-hub's horizons: a plain .sort() gives -1, -10, -11, ..., 0, 1, 10, 2
        setPlotScores('horizon', [0, 1, 2, 10, 11, -31, -4, -1]);
        App.setXaxisValues();

        assert.deepEqual(App.state.xaxis_values,
            ['-31', '-4', '-1', '0', '1', '2', '10', '11']);
    });

    test('setXaxisValues() keeps the lexicographic sort for non-numeric values', assert => {
        setPlotScores('variant', ['XBB', 'BA.2', 'JN.1']);
        App.setXaxisValues();

        assert.deepEqual(App.state.xaxis_values, ['BA.2', 'JN.1', 'XBB']);
    });

    test('setXaxisValues() orders labelled numeric task ids by value, not by label text', assert => {
        // the human-readable text is what Plotly plots, but sorting it would put '10 weeks ahead'
        // second, reintroducing the lexicographic order this change exists to fix
        App.state.task_id_text = {
            horizon: {'1': '1 week ahead', '2': '2 weeks ahead', '10': '10 weeks ahead'},
        };
        setPlotScores('horizon', [10, 1, 2]);
        App.setXaxisValues();

        assert.deepEqual(App.state.xaxis_values,
            ['1 week ahead', '2 weeks ahead', '10 weeks ahead']);
        assert.equal(App.getPlotlyLayout().xaxis.type, 'category',
            'the labels are what Plotly sees, so the axis is categorical');
    });

    test('setXaxisValues() sorts dates chronologically and de-duplicates', assert => {
        setPlotScores('reference_date', ['2025-01-20', '2025-01-06', '2025-01-13', '2025-01-06']);
        App.setXaxisValues();

        assert.deepEqual(App.state.xaxis_values,
            ['2025-01-06', '2025-01-13', '2025-01-20']);
    });

    test('getPlotlyLayout() pins numeric and categorical axes to category', assert => {
        // a linear axis auto-picks ticks between the values that exist, labelling horizons 0.5/1.5
        setPlotScores('horizon', [0, 1, 2, 3]);
        App.setXaxisValues();
        const xaxis = App.getPlotlyLayout().xaxis;

        assert.equal(xaxis.type, 'category', 'numeric task id values');
        assert.equal(xaxis.categoryorder, 'array');
        assert.deepEqual(xaxis.categoryarray, ['0', '1', '2', '3']);

        setPlotScores('variant', ['XBB', 'BA.2', 'JN.1']);
        App.setXaxisValues();

        assert.equal(App.getPlotlyLayout().xaxis.type, 'category', 'non-numeric task id values');
    });

    test('getPlotlyLayout() gives date axes a date type, so Plotly formats them as dates', assert => {
        setPlotScores('reference_date', ['2025-01-06', '2025-01-13', '2025-01-20']);
        App.setXaxisValues();

        assert.equal(App.getPlotlyLayout().xaxis.type, 'date');
    });

    test('getPlotlyLayout() sets no tickvals/ticktext, so Plotly thins labels to fit', assert => {
        // pinning one label per value is what made dense date axes unreadable (#57)
        const dates = Array.from({length: 60},
            (_, i) => new Date(Date.UTC(2025, 0, 6 + 7 * i)).toISOString().slice(0, 10));
        setPlotScores('reference_date', dates);
        App.setXaxisValues();
        const xaxis = App.getPlotlyLayout().xaxis;

        assert.strictEqual(xaxis.tickvals, undefined);
        assert.strictEqual(xaxis.ticktext, undefined);
    });

    test('getPlotlyLayout() titles the x axis with the selected disaggregate_by', assert => {
        setPlotScores('horizon', [0, 1, 2]);
        App.setXaxisValues();

        assert.equal(App.getPlotlyLayout().xaxis.title.text, 'horizon');
    });
});


//
// plot y-axis tests
//

QUnit.module('plot y-axis', (hooks) => {
    useStubbedApp(hooks);

    // Populate scores_plot with one row per x value, carrying a score for `metric`. The coverage
    // values here span well inside 0-100, which is what makes an autoranged axis visibly wrong.
    function setPlotScores(plotType, metric, scores) {
        App.state.selected_plot_type = plotType;
        App.state.selected_metric = metric;
        App.state.selected_disaggregate_by = 'horizon';
        App.state.scores_plot = scores.map((score, i) => ({
            model_id: 'model-a',
            horizon: String(i),
            [metric]: score,
        }));
        App.setXaxisValues();
    }

    test('getPlotlyLayout() pins the y axis to 0-100 for a coverage metric line plot', assert => {
        // coverage is read against its nominal level, so the axis has to be the full percentage
        // domain rather than the range the current selection's data happens to cover (#16)
        setPlotScores('Line plot', 'interval_coverage_95', [28.5, 76.0, 91.2, 100.0]);

        assert.deepEqual(App.getPlotlyLayout().yaxis.range, [0, 100]);
    });

    test('getPlotlyLayout() pins 0-100 for any coverage rate', assert => {
        setPlotScores('Line plot', 'interval_coverage_50', [12.0, 48.0, 55.5]);

        assert.deepEqual(App.getPlotlyLayout().yaxis.range, [0, 100]);
    });

    test('getPlotlyLayout() leaves the y axis autoranged for non-coverage metrics', assert => {
        setPlotScores('Line plot', 'wis', [1.5, 20.0, 300.0]);

        assert.strictEqual(App.getPlotlyLayout().yaxis.range, undefined);
    });

    test('getPlotlyLayout() leaves the heatmap y axis alone, coverage or not', assert => {
        // the heatmap's y axis is model_id, not the metric, so a 0-100 range would be meaningless
        setPlotScores('Heatmap', 'interval_coverage_95', [28.5, 76.0, 91.2]);

        assert.strictEqual(App.getPlotlyLayout().yaxis.range, undefined);
    });

    test('getPlotlyLayout() keeps the coverage y axis zoomable', assert => {
        setPlotScores('Line plot', 'interval_coverage_95', [28.5, 76.0, 91.2]);

        assert.false(App.getPlotlyLayout().yaxis.fixedrange);
    });

    test('getPlotlyLayout() frames both bounds of the coverage domain', assert => {
        // a gridline at 0 or 100 sits on the plot rectangle's edge and is half clipped, so the
        // frame is what makes the fixed domain's bounds visible
        setPlotScores('Line plot', 'interval_coverage_95', [76.0, 100.0]);
        const layout = App.getPlotlyLayout();

        assert.true(layout.xaxis.showline, 'x axis line drawn');
        assert.true(layout.xaxis.mirror, 'and mirrored to the top edge');
        assert.false(layout.yaxis.zeroline, 'zeroline off, so it does not double the bottom line');
    });

    test('getPlotlyLayout() leaves the frame off for non-coverage metrics', assert => {
        setPlotScores('Line plot', 'wis', [1.5, 20.0, 300.0]);
        const layout = App.getPlotlyLayout();

        assert.strictEqual(layout.xaxis.showline, undefined);
        assert.strictEqual(layout.xaxis.mirror, undefined);
        assert.strictEqual(layout.yaxis.zeroline, undefined);
    });

    test('getPlotlyLayout() draws a reference line at the nominal coverage level', assert => {
        // coverage is read against its nominal level, so the plot says where that level is (#17)
        setPlotScores('Line plot', 'interval_coverage_95', [28.5, 76.0, 91.2]);
        const shapes = App.getPlotlyLayout().shapes;

        assert.equal(shapes.length, 1, 'one reference line');
        assert.equal(shapes[0].y0, 95, 'at the nominal level');
        assert.equal(shapes[0].y1, 95, 'horizontal');
        assert.equal(shapes[0].xref, 'paper', 'spanning the full width, whatever the x axis type');
        assert.equal(shapes[0].layer, 'above', 'above the traces, which crowd it');
        assert.deepEqual(shapes[0].line, {color: '#444444', width: 1.5, dash: 'dash'});
    });

    test('getPlotlyLayout() draws the coverage reference line at the metric\'s own rate', assert => {
        setPlotScores('Line plot', 'interval_coverage_50', [12.0, 48.0, 55.5]);

        assert.equal(App.getPlotlyLayout().shapes[0].y0, 50);
    });

    test('getPlotlyLayout() draws a relative skill reference line at the baseline', assert => {
        setPlotScores('Line plot', 'wis_scaled_relative_skill', [0.27, 1.0, 2.82]);
        const shapes = App.getPlotlyLayout().shapes;

        assert.equal(shapes.length, 1, 'one reference line');
        assert.equal(shapes[0].y0, 1, 'at the baseline');
    });

    test('getPlotlyLayout() leaves the relative skill y axis autoranged', assert => {
        // the baseline model sits at exactly 1.0, so the reference line is in range without
        // pinning it - and pinning would squash the plot when models cluster far from 1.0
        setPlotScores('Line plot', 'wis_scaled_relative_skill', [0.27, 1.0, 2.82]);

        assert.strictEqual(App.getPlotlyLayout().yaxis.range, undefined);
    });

    test('getPlotlyLayout() draws no reference line for metrics without one', assert => {
        setPlotScores('Line plot', 'wis', [1.5, 20.0, 300.0]);

        assert.strictEqual(App.getPlotlyLayout().shapes, undefined);
    });

    test('getPlotlyLayout() draws no reference line on a heatmap', assert => {
        // the heatmap's y axis is model_id, so a horizontal line at a metric value is meaningless.
        // it encodes the reference as the midpoint of its diverging colorscale instead
        setPlotScores('Heatmap', 'interval_coverage_95', [28.5, 76.0, 91.2]);

        assert.strictEqual(App.getPlotlyLayout().shapes, undefined);
    });

    test('getPlotlyDataLinePlot() lets markers draw outside the plot rectangle', assert => {
        // the pinned [0, 100] range puts every 100%-coverage marker on the top edge, where the
        // default clip would cut it to a half circle
        setPlotScores('Line plot', 'interval_coverage_95', [76.0, 100.0, 100.0]);
        const traces = App.getPlotlyDataLinePlot();

        assert.true(traces.length > 0, 'traces were built');
        traces.forEach(trace => assert.false(trace.cliponaxis, `${trace.name} sets cliponaxis`));
    });
});
