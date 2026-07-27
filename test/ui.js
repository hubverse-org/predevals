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
        // initialize() doesn't reset scores_table, so clear it (it leaks across tests via the App
        // singleton) to keep tests order-independent — a fresh load has no scores fetched yet.
        App.state.scores_table = [];
    });
    hooks.afterEach(() => {
        App.fetchDataUpdateDisplay = originalFetchDataUpdateDisplay;
    });
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

    // DataTables isn't loaded in the jsdom test env; stub the pieces updateTable() touches so the
    // <thead> is still assembled (that DOM is built before the DataTable() hand-off).
    let originalDataTable;
    hooks.beforeEach(() => {
        originalDataTable = $.fn.DataTable;
        const DataTableStub = function () {
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
