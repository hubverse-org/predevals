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
