import {JSDOM} from "jsdom";
import jQueryFactory from 'jquery'; // per https://bugs.jquery.com/ticket/14549


//
// create `document` (with a 'qunit-fixture' <DIV> in it), `$`, and `Plotly` globals
//

const html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Title</title></head><body>\n' +
    '<div id="qunit-fixture"></div>\n' +
    '</body></html>';

const jsdomWindow = new JSDOM(html).window;
global.window = jsdomWindow;
global.document = jsdomWindow.document;
global.$ = jQueryFactory(jsdomWindow);


const PlotlyStub = {
    numCalls: 0,  // mock-style counter for below functions
    newPlot(graphDiv, data, layout, config) {
        this.numCalls++;
        graphDiv.on = function (eventName, callbackFunction) {  // called by `App.initializeUI()` for 'plotly_relayout's
        };
    },
    react(graphDiv, data, layout, config) {
        this.numCalls++;
    },
    relayout(graphDiv, update) {
        this.numCalls++;
    },
}
global.Plotly = PlotlyStub;
