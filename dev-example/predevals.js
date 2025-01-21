/**
 * predeval: A JavaScript (ES6 ECMAScript) module for viewing forecast evaluations.
 */

import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";


//
// helper functions
//

// TODO: move to utils.js
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

/**
 * `initialize()` helper that builds UI by adding DOM elements to $componentDiv. the UI is one row with two columns:
 * options on left and the table or plot on the right
 *
 * @param $componentDiv - an empty Bootstrap 4 row (JQuery object)
 * @private
 */
function _createUIElements($componentDiv) {
    //
    // helper functions for creating for rows
    //

    function _createFormRow(selectId, label) {
        return $(
            `<div class="form-row mb-2">\n` +
            `    <label for="${selectId}" class="col-sm-4 col-form-label pb-1">${label}:</label>\n` +
            `    <div class="col-sm-8">\n` +
            `        <select id="${selectId}" class="form-control"></select>\n` +
            `    </div>\n` +
            `</div>`)
    }


    //
    // make $optionsDiv (left column)
    //
    const $optionsDiv = $('<div class="col-md-3 g-col-3" id="predeval_options"></div>');

    // add Outcome, task ID, and Interval selects (form). NB: these are unfilled; their <OPTION>s are added by
    // initializeTargetVarsUI(), initializeTaskIDsUI(), and initializeIntervalsUI(), respectively
    const $optionsForm = $('<form></form>');
    const $fieldsetGeneral = $('<fieldset id="predeval_options_general" class="border p-2 mb-2"></fieldset>');
    $fieldsetGeneral.append($('<legend style="font-size: 1.2rem; margin: 0;">General Options</legend>'));
    $fieldsetGeneral.append(_createFormRow('predeval_target', 'Target'));
    $fieldsetGeneral.append(_createFormRow('predeval_eval_window', 'Evaluation window'));

    // the fieldset for plot options is hidden by default; it is shown when the plot tab is selected
    const $fieldsetPlot = $('<fieldset id="predeval_options_plot" class="border p-2 mb-2"></fieldset>')
        .hide();
    $fieldsetPlot.append($('<legend style="font-size: 1.2rem; margin: 0;">Plot Options</legend>'));
    $fieldsetPlot.append(_createFormRow('predeval_plot_type', 'Plot type'));
    $fieldsetPlot.append(_createFormRow('predeval_disaggregate_by', 'Disaggregate by'));
    $fieldsetPlot.append(_createFormRow('predeval_metric', 'Metric'));

    $optionsForm.append($fieldsetGeneral, $fieldsetPlot);
    $optionsDiv.append($optionsForm);

    //
    // make $evalDiv (right column)
    //
    const $evalDiv = $('<div class="col-md-9 g-col-9" id="predeval_main"></div>');

    // tabs for table and plot -- these are the tabs for navigation
    const $displayTabs = $('<ul class="nav nav-tabs" id="myTab" role="tablist"></ul>')
        .append(
            '<li class="nav-item" role="presentation"><button class="nav-link active" id="predeval_table_tab" data-bs-toggle="tab" data-bs-target="#predeval_table_pane" type="button" role="tab" aria-controls="home" aria-selected="true">Table</button></li>'
        )
        .append(
            '<li class="nav-item" role="presentation"><button class="nav-link" id="predeval_plot_tab" data-bs-toggle="tab" data-bs-target="#predeval_plot_pane" type="button" role="tab" aria-controls="home" aria-selected="true">Plot</button></li>'
        );

    // tabs for table and plot content -- these contain the content of the tabs
    const $displayTabPanes = $('<div class="tab-content"></div>');
    const $tableTabPane = $('<div class="tab-pane active" id="predeval_table_pane" role="tabpanel" aria-labelledby="predeval_table_tab" tabindex="0"></div>');
    const $plotTabPane = $('<div class="tab-pane" id="predeval_plot_pane" role="tabpanel" aria-labelledby="predeval_plot_tab" tabindex="0"></div>')
        .append($('<div id="predeval_plotly_div" style="width: 100%; height: 75vh; position: relative;"></div>'));
    $displayTabPanes.append($tableTabPane, $plotTabPane);

    // add tabs and panes to $evalDiv
    $evalDiv.append($displayTabs, $displayTabPanes);

    //
    // finish
    //

    $componentDiv.empty().append($optionsDiv, $evalDiv);
}


function parse_coverage_rate(score_name) {
    return parseFloat(score_name.slice(18));
}

const score_col_name_to_text_map = new Map(
    [
        ['model_id', 'Model'],
        ['wis', 'WIS'],
        ['wis_scaled_relative_skill', 'Rel. WIS'],
        ['ae_median', 'MAE'],
        ['ae_median_scaled_relative_skill', 'Rel. MAE'],
        ['ae_point', 'MAE'],
        ['ae_point_scaled_relative_skill', 'Rel. MAE'],
        ['se_point', 'MSE'],
        ['se_point_scaled_relative_skill', 'Rel. MSE']
    ]
)
/**
 * Converts a score column name to a human-readable string.
 * TODO: move to utils.js
 * @param {String} score_col_name - the name of a column in a scores data object
 */
function score_col_name_to_text(score_name) {
    const interval_coverage_regex = new RegExp('^interval_coverage_');
    if (interval_coverage_regex.test(score_name)) {
        return `${parse_coverage_rate(score_name)}\% Cov.`;
    } else {
        return score_col_name_to_text_map.get(score_name) || titleCase(score_name);
    }
}


//
// App
//

// this implements a straightforward SPA with state - based on https://dev.to/vijaypushkin/dead-simple-state-management-in-vanilla-javascript-24p0
const App = {

    //
    // non-options vars passed to `initialize()`
    //

    _fetchData: null,         // as documented in `initialize()`


    //
    // app state
    //

    state: {
        // Static data, fixed at time of creation:
        targets: [],
        eval_windows: [],
        task_id_text: {},

        // Dynamic/updated data, used to track 2 categories:
        // 1/2 Tracks UI state:
        selected_target: '',
        selected_plot_type: 'Heatmap',
        selected_disaggregate_by: '',
        selected_eval_window: '',
        sort_models_by: 'model_id',
        sort_models_direction: 1,
        xaxis_tickvals: [],
        // selected_plot_type: '',

        // 2/2 Data used to create tables or plots:
        scores_table: [], // not disaggregated by any task id variable
        scores_plot: [],  // disaggregated by App.State.selected_disaggregate_by
    },

    //
    // getters
    //

    /**
     * Get the currently selected target object.
     * @returns {Object} - the target object that corresponds to the currently selected target
     * Example: {
     *   target_id: 'wk inc flu hosp',
     *   metrics: Array(6),
     *   relative_metrics: Array(2),
     *   baseline: 'FluSight-baseline',
     *   disaggregate_by: Array(4)
     * }
     */
    getSelectedTargetObj() {
        return this.state.targets.filter((obj) => obj.target_id === this.state.selected_target)[0];
    },


    //
    // initialization-related functions
    //

    /**
     * Initialize this app using the passed args. Note that we support specifying some aspects of UI selection state via
     * these URL parameters: `as_of`, `interval`, `target_var`, `model` (one or more), and task_ids (one or more). For
     * example, this URL specifies the first three along with two models and two task_ids:
     *   http://.../?as_of=2022-01-29&model=COVIDhub-baseline&model=COVIDhub-ensemble&interval=95%25&target_var=week_ahead_incident_deaths&scenario_id=1&location=48
     *
     * @param {String} componentDiv - id of a DOM node to populate. it must be an empty Bootstrap 4 row
     * @param {Function} _fetchData - function as documented in README.md .
     *   args: isForecast, targetKey, taskIDs, referenceDate
     * @param {Object} options - predeval initialization options
     * @returns {String} - error message String or null if no error
     */
    initialize(componentDiv, _fetchData, options) {
        console.debug('initialize(): entered');

        // validate componentDiv
        const componentDivEle = document.getElementById(componentDiv);
        if (componentDivEle === null) {
            throw `componentDiv DOM node not found: '${componentDiv}'`;
        }

        // save static vars
        this._fetchData = _fetchData;
        this.state.targets = options['targets'];
        this.state.eval_windows = options['eval_windows'];
        this.state.task_id_text = options['task_id_text'];

        // set initial selected state for entries specified in options
        this.state.selected_target = options['targets'][0].target_id;
        this.state.selected_eval_window = options['eval_windows'][0].window_name;
        this.state.selected_disaggregate_by = options['targets'][0].disaggregate_by[0];
        this.state.selected_metric = this.getSelectedTargetObj().metrics[0];

        // populate UI elements, setting selection state to initial values defined above
        const $componentDiv = $(componentDivEle);
        _createUIElements($componentDiv);
        this.initializeUI();

        // wire up UI controls (event handlers)
        this.addEventHandlers();

        // pull initial data (scores_table, scores_plot) and update the display to show first table and plot
        this.fetchDataUpdateDisplay(true, true);

        return null;  // no error
    },
    initializeUI() {
        // populate options (left column)
        this.initializeTargetUI();
        this.initializeEvalWindowUI();
        this.initializePlotTypeUI();
        this.initializeDisaggregateByUI();
        this.initializeMetricUI();

        // initialize plotly (right column)
        const plotyDiv = document.getElementById('predeval_plotly_div');
        const data = []  // data will be updated by `updatePlot()`
        const layout = this.getPlotlyLayout();
        Plotly.newPlot(plotyDiv, data, layout, {
            modeBarButtonsToRemove: ['lasso2d', 'autoScale2d'],
        });
    },
    initializeTargetUI() {
        // populate the target <SELECT>
        const $targetSelect = $("#predeval_target");
        const thisState = this.state;
        thisState.targets.forEach(function (target) {
            const target_id = target.target_id;
            const selected = target_id === thisState.selected_target ? 'selected' : '';
            const optionNode = `<option value="${target_id}" ${selected} >${target_id}</option>`;
            $targetSelect.append(optionNode);
        });
    },
    initializeEvalWindowUI() {
        // populate the eval_window <SELECT>
        const $windowSelect = $("#predeval_eval_window");
        const thisState = this.state;
        this.state.eval_windows.forEach(function (window) {
            const window_name = window.window_name;
            const selected = window_name === thisState.selected_eval_window ? 'selected' : '';
            const optionNode = `<option value="${window_name}" ${selected} >${window_name}</option>`;
            $windowSelect.append(optionNode);
        });
    },
    initializePlotTypeUI() {
        // populate the plot_type <SELECT>
        const $plotTypeSelect = $("#predeval_plot_type");
        const thisState = this.state;
        const plot_types = ['Line plot', 'Heatmap'];
        plot_types.forEach(function (type) {
            const selected = type === thisState.selected_plot_type ? 'selected' : '';
            const optionNode = `<option value="${type}" ${selected} >${type}</option>`;
            $plotTypeSelect.append(optionNode);
        });
    },
    initializeDisaggregateByUI() {
        // populate the disaggregate_by <SELECT>
        // this is the "Disaggregate by" dropdown
        const $disaggregateBySelect = $("#predeval_disaggregate_by");
        const thisState = this.state;
        const selected_target_obj = this.getSelectedTargetObj();
        $disaggregateBySelect.empty();
        selected_target_obj.disaggregate_by.forEach(function (by) {
            const selected = by === thisState.selected_disaggregate_by ? 'selected' : '';
            const optionNode = `<option value="${by}" ${selected} >${by}</option>`;
            $disaggregateBySelect.append(optionNode);
        });
    },
    initializeMetricUI() {
        // populate the metric <SELECT>
        const thisState = this.state;
        const $metricSelect = $('#predeval_metric');
        const selected_target_obj = this.getSelectedTargetObj();

        // empty because we're going to re-populate it whenever the target changes
        $metricSelect.empty();

        // TODO: if thisState.selecterd_metric is not in the new selected_target_obj.metrics, set it to the first metric
        selected_target_obj.metrics.forEach(function (metric) {
            const selected = metric === thisState.selected_metric ? 'selected' : '';
            const optionNode = `<option value="${metric}" ${selected} >${score_col_name_to_text(metric)}</option>`;
            $metricSelect.append(optionNode);
        });
    },
    addEventHandlers() {
        // user changes selection for target dropdown
        $('#predeval_target').on('change', function () {
            App.state.selected_target = this.value;
            // possible values for disaggregate_by and metrics depend on the target
            App.initializeDisaggregateByUI();
            App.initializeMetricUI();

            const isFetchFirst = true;  // fetch data before updating display
            const isFetchBoth = true;   // fetch both table and plot data; this is a general setting change
            App.fetchDataUpdateDisplay(isFetchFirst, isFetchBoth);
        });

        // user changes selection for evaluation window dropdown
        $('#predeval_eval_window').on('change', function () {
            App.state.selected_eval_window = this.value;

            const isFetchFirst = true;  // fetch data before updating display
            const isFetchBoth = true;   // fetch both table and plot data; this is a general setting change
            App.fetchDataUpdateDisplay(isFetchFirst, isFetchBoth);
        });

        // user changes selection for plot type dropdown
        $('#predeval_plot_type').on('change', function () {
            App.state.selected_plot_type = this.value;

            const isFetchFirst = false; // no need to fetch data, just update the plot
            const isFetchBoth = false;  // no need to fetch both table and plot data
            App.fetchDataUpdateDisplay(isFetchFirst, isFetchBoth);
        });

        // user changes selection for dissagregate_by dropdown
        $('#predeval_disaggregate_by').on('change', function () {
            App.state.selected_disaggregate_by = this.value;

            const isFetchFirst = true;  // fetch data before updating display
            const isFetchBoth = false;   // fetch plot data only; this setting doesn't affect the table
            App.fetchDataUpdateDisplay(isFetchFirst, isFetchBoth);
        });
        
        // user changes selection for metric dropdown
        $('#predeval_metric').on('change', function () {
            App.state.selected_metric = this.value;

            const isFetchFirst = false; // no need to fetch data, just update display based on a new column
            const isFetchBoth = false;  // no need to fetch both table and plot data
            App.fetchDataUpdateDisplay(isFetchFirst, isFetchBoth);
        });

        // user changes selected tab (table or plot)
        $('button[data-bs-toggle="tab"]').on('shown.bs.tab', function (event) {
            if (event.target.id === 'predeval_plot_tab') {
                // the plot tab has been selected
                // call updatePlot(); the main purpose is to ensure that the
                // plot takes up the full available width and height of its container
                App.updatePlot();

                // show the plot options fieldset
                $('#predeval_options_plot').fadeIn();
            } else {
                // the table tab has been selected
                // hide the plot options fieldset
                $('#predeval_options_plot').fadeOut();
            }
        })
    },

    //
    // data fetch-related functions
    //

    /**
     * Updates the table or plot, optionally first fetching data.
     *
     * @param isFetchFirst true if should fetch before plotting. false if no fetch
     * @param isFetchCurrentTruth applies if isFetchFirst: controls whether current truth is fetched in addition to
     *   as_of truth and forecasts. ignored if not isFetchFirst
     */
    fetchDataUpdateDisplay(isFetchFirst, isFetchBoth) {
        if (isFetchFirst) {
            const promises = [this.fetchScores(isFetchBoth)];
            console.debug(`fetchDataUpdateDisplay(${isFetchFirst}): waiting on promises`);
            Promise.all(promises).then((values) => {
                console.debug(`fetchDataUpdateDisplay(${isFetchFirst}): Promise.all() done. updating display`, values);
                this.updateDisplay();
            });
        } else {
            console.debug(`fetchDataUpdateDisplay(${isFetchFirst}): updating display`);
            this.updateDisplay();
        }
    },
    fetchScores(isFetchBoth) {
        // fetch scores data
        // Any time we would need to fetch scores_table data, we also fetch scores_plot data
        // because a general setting has been changed (e.g., target, eval_window)
        // However, we may need to fetch scores_plot data without fetching scores_table data
        // (e.g., when the disaggregate_by variable is changed)
        const promises = [this.fetchScoresTableOrPlot(false)];
        if (isFetchBoth) {
            promises.push(this.fetchScoresTableOrPlot(true));
        }
        return Promise.all(promises)
            .then(values => console.debug('fetchScores(): Promise.all() done'))
            .catch(error => console.error(`fetchScores(): error: ${error.message}`));
    },
    fetchScoresTableOrPlot(isFetchScoresTable) {
        const interval_coverage_regex = new RegExp('^interval_coverage_');
        let disaggregate_by;
        if (isFetchScoresTable) {
            // note: '(None)' is our conventional value for no disaggregation
            disaggregate_by = '(None)';
            this.state.scores_table = [];  // clear in case of error
        } else{
            disaggregate_by = this.state.selected_disaggregate_by;
            this.state.scores_plot = [];  // clear in case of error
        }
        return this._fetchData(  // Promise
            this.state.selected_target,
            this.state.selected_eval_window,
            disaggregate_by)
            .then((data) => {
                // convert score columns to floats
                // TODO: extract to helper function for clarity
                for (const col_name of data.columns) {
                    if (!['model_id', 'n', this.state.selected_disaggregate_by].includes(col_name)) {
                        // This is a score column, so convert values in all rows to float
                        for (let i = 0; i < data.length; i++) {
                            data[i][col_name] = parseFloat(data[i][col_name]);

                            // If it's an interval coverage column, multiply by 100
                            if (interval_coverage_regex.test(col_name)) {
                                data[i][col_name] *= 100;
                            }
                       }
                    }
                }

                // update state
                if (isFetchScoresTable) {
                    this.state.scores_table = data;
                } else{
                    this.state.scores_plot = data;
                }
            })
            .catch(error => console.error(`fetchScoresTableOrPlot(${isFetchScoresTable}): error: ${error.message}`));
    },

    // update display
    updateDisplay() {
        console.log('updateDisplay(): entered');
        this.updateTable();
        this.updatePlot();
    },

    // update display with table
    updateTable() {
        const thisState = this.state;
        const $evalTablePane = $('#predeval_table_pane');
        const $table = $('<table id="predeval_table" class="table table-sm table-striped table-bordered"></table>');
        const $thead = $('<thead></thead>');
        const $tbody = $('<tbody></tbody>');
        const $tr = $('<tr></tr>');
        const $th = $('<th></th>');
        const $td = $('<td></td>');

        // sort scores
        // TODO: refactor to a function for sorting scores, shared with plot code
        // use of d3.ascending() and d3.descending() is verbose,
        // but it works reliably for all data types
        // (have not thoroughly explored alternatives)
        const sort_models_by = this.state.sort_models_by;
        if (this.state.sort_models_direction > 0) {
            this.state.scores_table.sort((a, b) => {
                return d3.ascending(toLowerCaseIfString(a[sort_models_by]),
                                    toLowerCaseIfString(b[sort_models_by]));
            });
        } else {
            this.state.scores_table.sort((a, b) => {
                return d3.descending(toLowerCaseIfString(a[sort_models_by]),
                                     toLowerCaseIfString(b[sort_models_by]));
            });
        }

        // add header row
        const cols = thisState.scores_table.columns;
        cols.forEach(function (c) {
            // set up class to use for indicating column sort status
            let c_selected = c === thisState.sort_models_by;
            let c_direction = thisState.sort_models_direction;
            let c_arrow;
            if (c_selected) {
                c_arrow = c_direction > 0 ? 'bi bi-caret-up-fill' : 'bi bi-caret-down-fill';
            } else {
                c_arrow = 'bi bi-chevron-expand';
            }

            // add header cell for this column
            $tr.append(
                $th.clone()
                    .hover(
                        function () {
                            // on hover, change background color, cursor, and arrow color
                            $(this).css('background-color', 'rgba(0,0,0,.075)')
                                .css('cursor', 'pointer');
                            $(this).find('i')
                                .addClass('text-primary');
                        },
                        function () {
                            // on exit hover, reset background color, cursor, and arrow color
                            $(this).css('background-color', '')
                                .css('cursor', 'default');
                            $(this).find('i')
                                .removeClass('text-primary');
                        }
                    )
                    .on('click', function() {
                        // click column header to sort by that column
                        App.updateTableSorting(c);
                    })
                    .text(score_col_name_to_text(c))
                    .prepend($(`<i class="bi ${c_arrow}" role="img" aria-label="Sort"></i>`))
            );
        });
        $thead.append($tr);
        $table.append($thead);

        // add data
        for (let i = 0; i < thisState.scores_table.length; i++) { // table rows
            const $tr = $('<tr></tr>');
            for (let j = 0; j < cols.length; j++) { // table columns
                const col_name = cols[j];
                let text_value = thisState.scores_table[i][col_name];
                if (col_name !== 'model_id' && col_name !== 'n') {
                    // format score columns
                    // Note: we only build tables if disaggregate_by is '(None)',
                    // so we can assume that all columns other than model_id and n are scores

                    // TODO: consider whether to make these formatting behaviors configurable
                    // TODO: consider refactor to helper function for score formatting

                    // Round to 2 decimal places for relative_skill columns and 1 or all other score columns
                    text_value = text_value.toFixed(get_round_decimals(col_name));
                }
                $tr.append($td.clone().text(text_value));
            }
            $tbody.append($tr);
        }
        $table.append($tbody);

        // remove any existing table and add the new table to document
        $evalTablePane.empty().append($table);
    },
    updateTableSorting(col_name) {
        // handler for column header click to sort by that column
        if (this.state.sort_models_by === col_name) {
            this.state.sort_models_direction *= -1;
        } else {
            this.state.sort_models_by = col_name;
            this.state.sort_models_direction = 1;
        }

        // updateTable performs data sort and re-renders table
        this.updateTable();
    },

    //
    // plot-related functions
    //

    /**
     * Updates the plot
     */
    updatePlot() {
        const plotlyDiv = document.getElementById('predeval_plotly_div');

        // set the x-axis tickvals; stored in App state, determines the order of:
        // - data items created by getPlotlyData()
        // - x-axis labels created by getPlotlyLayout()
        this.setXaxisTickvals();

        // get data and layout
        const data = this.getPlotlyData();
        let layout = this.getPlotlyLayout();
        if (data.length === 0) {
            layout = {title: {text: `No score data found.`}};
        }

        // update plot
        Plotly.react(plotlyDiv, data, layout);
    },
    setXaxisTickvals() {
        // set the xaxis_tickvals property of the App state
        // used in getPlotlyLayout() and getPlotlyData()

        let all_xaxis_vals = this.state.scores_plot.map(d => d[this.state.selected_disaggregate_by]);

        // If x axis is a task ID for which human-readable text was provided, use that text
        // TODO: refactor to a function for mapping task id values to text
        if (Object.keys(this.state.task_id_text).includes(this.state.selected_disaggregate_by)) {
            console.log('Disaggregating by task ID with text');
            const task_id_text = this.state.task_id_text[this.state.selected_disaggregate_by];
            all_xaxis_vals = all_xaxis_vals.map(d => task_id_text[d]);
        }

        // get unique values and sort
        const xaxis_tickvals_unsorted = [...new Set(all_xaxis_vals)];
        const xaxis_tickvals = xaxis_tickvals_unsorted.sort();

        // update state
        this.state.xaxis_tickvals = xaxis_tickvals;
    },
    getPlotlyLayout() {
        if (this.state.scores_plot.length === 0) {
            return {};
        }

        let yaxis_title;
        if (this.state.selected_plot_type === 'Line plot') {
            yaxis_title = score_col_name_to_text(this.state.selected_metric);
        } else if (this.state.selected_plot_type === 'Heatmap') {
            yaxis_title = null;
        }
        let plotly_layout = {
            autosize: true,
            showlegend: true,
            title: {
                text: `${score_col_name_to_text(this.state.selected_metric)} by ${this.state.selected_disaggregate_by}`,
                xanchor: 'center',
                yanchor: 'top',
            },
            xaxis: {
                title: {text: this.state.disaggregate_by},
                tickvals: this.state.xaxis_tickvals,
                ticktext: this.state.xaxis_tickvals,
                categoryorder: 'array',
                categoryarray: this.state.xaxis_tickvals,
                fixedrange: false,
                automargin: true
            },
            yaxis: {
                title: {text: yaxis_title},
                fixedrange: false,
                automargin: true
            }
        }
        if (this.state.selected_plot_type === 'Line plot') {
            plotly_layout.autosize = true;
            $('#predeval_plotly_div').css('height', '75vh');
        } else if (this.state.selected_plot_type === 'Heatmap') {
            plotly_layout.width = ('#predeval_plotly_div').width;

            // set height of plotly div based on number of models
            // 20 px per model, plus 40 px for title and x-axis label
            // this computation is somewhat arbitrary because it's not
            // tied to tha actual title and x-axis label heights,
            // but it seems to work
            const unique_models = new Set(this.state.scores_plot.map(d => d.model_id))
            const n_models = unique_models.size;
            plotly_layout.height = 40 + n_models * 20;

            // set height of plotly div to height of plotly layout
            $('#predeval_plotly_div').css('height', plotly_layout.height + 'px');
        }

        return plotly_layout;
    },
    getPlotlyData() {
        if (this.state.selected_plot_type === 'Line plot') {
            return this.getPlotlyDataLinePlot();
        } else if (this.state.selected_plot_type === 'Heatmap') {
            return this.getPlotlyDataHeatmap();
        }
    },
    getPlotlyDataLinePlot() {
        const thisState = this.state;
        let pd = [];

        // early return if no data
        if (thisState.scores_plot.length === 0) {
            return pd;
        }

        // group by model
        const grouped = d3.group(thisState.scores_plot, d => d.model_id);
        
        // add a line for scores for each model
        for (const [model_id, model_scores] of grouped) {
            // get x and y pairs, not sorted
            let x_unsrt = model_scores.map(d => d[thisState.selected_disaggregate_by]);
            // TODO: refactor to a function for mapping task id values to text
            if (Object.keys(thisState.task_id_text).includes(thisState.selected_disaggregate_by)) {
                const task_id_text = thisState.task_id_text[thisState.selected_disaggregate_by];
                x_unsrt = x_unsrt.map(d => task_id_text[d]);
            }

            const y_unsrt = model_scores.map(d => d[thisState.selected_metric]);
            let x_y = x_unsrt.map((val, i) => [val, y_unsrt[i]]);

            // sort (x, y) pairs in order of this.state.xaxis_tickvals
            x_y.sort((a, b) => thisState.xaxis_tickvals.indexOf(a[0]) - thisState.xaxis_tickvals.indexOf(b[0]));
            const x = x_y.map(d => d[0]);
            const y = x_y.map(d => d[1]);

            // object for Plotly
            const line_data = {
                x: x,
                y: y,
                mode: 'lines+markers',
                type: 'scatter',
                name: model_id,
                hovermode: false,
                hovertemplate: `model: %{data.name}<br>${thisState.selected_disaggregate_by}: %{x}<br>${score_col_name_to_text(this.state.selected_metric)}: %{y:.${get_round_decimals(this.state.selected_metric)}f}<extra></extra>`,
                opacity: 0.7,
            };
            pd.push(line_data);
        }

        return pd
    },
    getPlotlyDataHeatmap() {
        console.log('getPlotlyDataHeatmap(): entered');
        const thisState = this.state;
        const interval_coverage_regex = new RegExp('^interval_coverage_');
        const is_coverage_metric = interval_coverage_regex.test(thisState.selected_metric);
        const relative_skill_regex = new RegExp('_scaled_relative_skill$');
        const is_rel_skill_metric = relative_skill_regex.test(thisState.selected_metric);
        // const is_logscale = !is_coverage_metric;

        let pd = [];

        // early return if no data
        if (thisState.scores_plot.length === 0) {
            return pd;
        }

        // custom color scales
        // TODO: refactor to a function for color scale
        // interval coverage: divergent scale with midpoint at the nominal coverage rate
        // proper scores and relative skill metrics: log-scale sequential colorscale
        let eps; // constant added to scores before log-scaling to avoid log(0)
        let data_scaler;
        let d3_colorscale;
        let colorscale_heatmap_data;
        let colorbar_tick_format;
        const min_z = d3.min(thisState.scores_plot, d => d[thisState.selected_metric]);
        const max_z = d3.max(thisState.scores_plot, d => d[thisState.selected_metric]);
        if (is_coverage_metric) {
            // interval coverage
            eps = 0.0;
            colorbar_tick_format = `.${get_round_decimals(this.state.selected_metric)}f`;

            d3_colorscale = d3.scaleSequential(d3.interpolateRdBu);
            const colorscale_range = [0, 1]; // red low, blue high

            // we use a divergent color scale on a linear scale from
            // [nominal_level - delta, nominal_level + delta] to colorscale_range,
            // where delta is the maximum of nominal_level and 100 - nominal_level
            // (to ensure that the color scale is centered at the nominal level)
            const nominal_level = parse_coverage_rate(thisState.selected_metric);
            const delta = Math.max(nominal_level, 100 - nominal_level);
            data_scaler = d3.scaleLinear([nominal_level - delta, nominal_level + delta], colorscale_range);
        } else {
            // proper scores and relative skill metrics
            // For relative skill metrics, we use a diverging red-blue color scale
            // with 1.0 at white, the minimum value at blue, and the maximum value at red.
            // For proper scores, we use a sequential viridis color scale with
            // blue at the minimum value (good scores) and yellow at the maximum value (poor scores)

            // These scores are generally positive and skewed, so we used a log scale
            // There is not great support for log scales in Plotly heatmaps,
            // see https://github.com/plotly/documentation/issues/1611.
            // Our approach follows the recommendation in the comments there:
            // 1. log-transform the data
            // 2. apply color scale to the log-transformed data
            // 3. add a colorbar with tickvals and ticktext for the original data values
            // 4. update hover text to show the original data values

            // for log-scale, we add a small constant to avoid log(0)
            // we use the minimum nonzero value divided by 2 to get
            // something that's placed reasonably well relative to other data
            const nonzero_min = d3.min(
                thisState.scores_plot.filter(d => d[thisState.selected_metric] > 0),
                d => d[thisState.selected_metric]
            );
            eps = nonzero_min / 2.0;

            // scientific notation for colorbar tick labels
            colorbar_tick_format = `.${get_round_decimals(this.state.selected_metric)}f`;

            // color scale type and direction depends on metric type
            let colorscale_range;
            if (is_rel_skill_metric) {
                // d3 provides a color scale with red at 0.0 and blue at 1.0
                // we want the opposite, so we reverse the scale
                const d3_colorscale_raw = d3.scaleSequential(d3.interpolateRdBu);
                d3_colorscale = (x) => d3_colorscale_raw(1.0 - x);
                colorscale_range = [0, 1]; // blue low, red high

                // our color scale is on a log scale from [1 / max_z, max_z] to colorscale_range
                // or [min_z, 1 / min_z] to colorscale_range, whichever range is larger
                const logscale_max = Math.max(1 / (min_z + eps), max_z + eps);
                data_scaler = d3.scaleLog([1 / logscale_max, logscale_max], colorscale_range);
            } else {
                // counter to documentation, the d3 viridis color scale returns
                // hex representions of color rather than rgb; plotly requires rgb
                const d3_colorscale_raw = d3.scaleSequential(d3.interpolateViridis);
                d3_colorscale = (x) => hexToRGB(d3_colorscale_raw(x));
                colorscale_range = [0, 1]; // blue low, yellow high
                data_scaler = d3.scaleLog([min_z + eps, max_z + eps], colorscale_range);
            }
        }

        // set up the custom colorscale for the heatmap
        const all_z = thisState.scores_plot.map(d => data_scaler(d[thisState.selected_metric] + eps))
        const unique_z = [...new Set(all_z)]
            .filter(item => item !== undefined)
            .sort((a, b) => a - b);
        const linear_scaler = d3.scaleLinear([unique_z[0], unique_z[unique_z.length - 1]], [0, 1]);

        // array of [t, color] pairs where t is in [0, 1] and color is an rgb string
        const custom_colorscale = unique_z.map(z => {
            return [linear_scaler(z), d3_colorscale(z)];
        });
        colorscale_heatmap_data = {
            colorscale: custom_colorscale,
            showscale: true,
            colorbar: {
                tickmode: 'array',
                tickvals: data_scaler.ticks().map((x) => data_scaler(x + eps)),
                ticktext: data_scaler.ticks().map(data_scaler.tickFormat(12, colorbar_tick_format))
            }
        };

        // group score data by model
        const grouped = d3.group(thisState.scores_plot, d => d.model_id);
        
        let x = thisState.xaxis_tickvals; // this.state.selected_disaggregate_by
        let y = Array.from(grouped.keys()); // model_id
        let z = []; // scores on transformed scale (log scale if applicable)
        let z_orig = []; // scores on original scale

        // add a heatmap row for scores for each model
        for (const [model_id, model_scores] of grouped) {
            // get x and z pairs, not sorted
            let x_unsrt = model_scores.map(d => d[thisState.selected_disaggregate_by]);
            // TODO: refactor to a function for mapping task id values to text
            if (Object.keys(thisState.task_id_text).includes(thisState.selected_disaggregate_by)) {
                const task_id_text = thisState.task_id_text[thisState.selected_disaggregate_by];
                x_unsrt = x_unsrt.map(d => task_id_text[d]);
            }

            const z_unsrt = model_scores.map(d => data_scaler(d[thisState.selected_metric] + eps));
            const z_orig_unsrt = model_scores.map(d => d[thisState.selected_metric]);
            let x_z = x_unsrt.map((val, i) => [val, z_unsrt[i], z_orig_unsrt[i]]);

            // sort (x, z, z_orig) tuples in order of this.state.xaxis_tickvals
            x_z.sort((a, b) => thisState.xaxis_tickvals.indexOf(a[0]) - thisState.xaxis_tickvals.indexOf(b[0]));

            // get z values in the order of xaxis_tickvals,
            // including missing values represented as null
            const model_z = thisState.xaxis_tickvals.map(x_val => {
                const this_x_z_val = x_z.find(d => d[0] === x_val);
                return this_x_z_val ? this_x_z_val[1] : null;
            });
            const model_z_orig = thisState.xaxis_tickvals.map(x_val => {
                const this_x_z_val = x_z.find(d => d[0] === x_val);
                return this_x_z_val ? this_x_z_val[2] : null;
            });

            z.push(model_z);
            z_orig.push(model_z_orig);
        }

        // object for Plotly
        let heatmap_data = {
            x: x,
            y: y,
            z: z,
            customdata: z_orig,
            type: 'heatmap',
            hovertemplate: `${thisState.selected_disaggregate_by}: %{x}<br>model: %{y}<br>${score_col_name_to_text(this.state.selected_metric)}: %{customdata:.${get_round_decimals(this.state.selected_metric)}f}<extra></extra>`,
            hoverongaps: false
        };

        // combine data for heatmap with custom colorscale and add to plot data
        pd.push({...heatmap_data, ...colorscale_heatmap_data});

        return pd
    },
};


export default App;  // export the module's main entry point