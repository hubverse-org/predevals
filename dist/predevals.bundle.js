import*as e from"https://cdn.jsdelivr.net/npm/d3@7/+esm";var t={d:(e,a)=>{for(var s in a)t.o(a,s)&&!t.o(e,s)&&Object.defineProperty(e,s,{enumerable:!0,get:a[s]})},o:(e,t)=>Object.prototype.hasOwnProperty.call(e,t)},a={};t.d(a,{A:()=>_});const s=(i={ascending:()=>e.ascending,descending:()=>e.descending,group:()=>e.group,interpolateRdBu:()=>e.interpolateRdBu,interpolateViridis:()=>e.interpolateViridis,max:()=>e.max,min:()=>e.min,scaleLinear:()=>e.scaleLinear,scaleLog:()=>e.scaleLog,scaleSequential:()=>e.scaleSequential},l={},t.d(l,i),l);var i,l;function o(e){return"string"==typeof e?e.toLowerCase():e}function n(e){return new RegExp("_scaled_relative_skill$").test(e)?2:1}function r(e){return parseFloat(e.slice(18))}const d=new Map([["model_id","Model"],["wis","WIS"],["wis_scaled_relative_skill","Rel. WIS"],["ae_median","MAE"],["ae_median_scaled_relative_skill","Rel. MAE"],["ae_point","MAE"],["ae_point_scaled_relative_skill","Rel. MAE"],["se_point","MSE"],["se_point_scaled_relative_skill","Rel. MSE"]]);function c(e){return new RegExp("^interval_coverage_").test(e)?`${r(e)}% Cov.`:d.get(e)||e.toLowerCase().replace(/\b\w/g,(e=>e.toUpperCase()))}const p={_fetchData:null,state:{targets:[],eval_windows:[],task_id_text:{},selected_target:"",selected_plot_type:"Heatmap",selected_disaggregate_by:"",selected_eval_window:"",sort_models_by:"model_id",sort_models_direction:1,xaxis_tickvals:[],scores_table:[],scores_plot:[]},getSelectedTargetObj(){return this.state.targets.filter((e=>e.target_id===this.state.selected_target))[0]},initialize(e,t,a){console.debug("initialize(): entered");const s=document.getElementById(e);if(null===s)throw`componentDiv DOM node not found: '${e}'`;return this._fetchData=t,this.state.targets=a.targets,this.state.eval_windows=a.eval_windows,this.state.task_id_text=a.task_id_text,this.state.selected_target=a.targets[0].target_id,this.state.selected_eval_window=a.eval_windows[0].window_name,this.state.selected_disaggregate_by=a.targets[0].disaggregate_by[0],this.state.selected_metric=this.getSelectedTargetObj().metrics[0],function(e){function t(e,t){return $(`<div class="form-row mb-2">\n    <label for="${e}" class="col-sm-4 col-form-label pb-1">${t}:</label>\n    <div class="col-sm-8">\n        <select id="${e}" class="form-control"></select>\n    </div>\n</div>`)}const a=$('<div class="col-md-3 g-col-3" id="predeval_options"></div>'),s=$("<form></form>"),i=$('<fieldset id="predeval_options_general" class="border p-2 mb-2"></fieldset>');i.append($('<legend style="font-size: 1.2rem; margin: 0;">General Options</legend>')),i.append(t("predeval_target","Target")),i.append(t("predeval_eval_window","Evaluation window"));const l=$('<fieldset id="predeval_options_plot" class="border p-2 mb-2"></fieldset>').hide();l.append($('<legend style="font-size: 1.2rem; margin: 0;">Plot Options</legend>')),l.append(t("predeval_plot_type","Plot type")),l.append(t("predeval_disaggregate_by","Disaggregate by")),l.append(t("predeval_metric","Metric")),s.append(i,l),a.append(s);const o=$('<div class="col-md-9 g-col-9" id="predeval_main"></div>'),n=$('<ul class="nav nav-tabs" id="myTab" role="tablist"></ul>').append('<li class="nav-item" role="presentation"><button class="nav-link active" id="predeval_table_tab" data-bs-toggle="tab" data-bs-target="#predeval_table_pane" type="button" role="tab" aria-controls="home" aria-selected="true">Table</button></li>').append('<li class="nav-item" role="presentation"><button class="nav-link" id="predeval_plot_tab" data-bs-toggle="tab" data-bs-target="#predeval_plot_pane" type="button" role="tab" aria-controls="home" aria-selected="true">Plot</button></li>'),r=$('<div class="tab-content"></div>'),d=$('<div class="tab-pane active" id="predeval_table_pane" role="tabpanel" aria-labelledby="predeval_table_tab" tabindex="0"></div>'),c=$('<div class="tab-pane" id="predeval_plot_pane" role="tabpanel" aria-labelledby="predeval_plot_tab" tabindex="0"></div>').append($('<div id="predeval_plotly_div" style="width: 100%; height: 75vh; position: relative;"></div>'));r.append(d,c),o.append(n,r),e.empty().append(a,o)}($(s)),this.initializeUI(),this.addEventHandlers(),this.fetchDataUpdateDisplay(!0,!0),null},initializeUI(){this.initializeTargetUI(),this.initializeEvalWindowUI(),this.initializePlotTypeUI(),this.initializeDisaggregateByUI(),this.initializeMetricUI();const e=document.getElementById("predeval_plotly_div"),t=this.getPlotlyLayout();Plotly.newPlot(e,[],t,{modeBarButtonsToRemove:["lasso2d","autoScale2d"]})},initializeTargetUI(){const e=$("#predeval_target"),t=this.state;t.targets.forEach((function(a){const s=a.target_id,i=`<option value="${s}" ${s===t.selected_target?"selected":""} >${s}</option>`;e.append(i)}))},initializeEvalWindowUI(){const e=$("#predeval_eval_window"),t=this.state;this.state.eval_windows.forEach((function(a){const s=a.window_name,i=`<option value="${s}" ${s===t.selected_eval_window?"selected":""} >${s}</option>`;e.append(i)}))},initializePlotTypeUI(){const e=$("#predeval_plot_type"),t=this.state;["Line plot","Heatmap"].forEach((function(a){const s=`<option value="${a}" ${a===t.selected_plot_type?"selected":""} >${a}</option>`;e.append(s)}))},initializeDisaggregateByUI(){const e=$("#predeval_disaggregate_by"),t=this.state,a=this.getSelectedTargetObj();e.empty(),a.disaggregate_by.forEach((function(a){const s=`<option value="${a}" ${a===t.selected_disaggregate_by?"selected":""} >${a}</option>`;e.append(s)}))},initializeMetricUI(){const e=this.state,t=$("#predeval_metric"),a=this.getSelectedTargetObj();t.empty(),a.metrics.forEach((function(a){const s=`<option value="${a}" ${a===e.selected_metric?"selected":""} >${c(a)}</option>`;t.append(s)}))},addEventHandlers(){$("#predeval_target").on("change",(function(){p.state.selected_target=this.value,p.initializeDisaggregateByUI(),p.initializeMetricUI(),p.fetchDataUpdateDisplay(!0,!0)})),$("#predeval_eval_window").on("change",(function(){p.state.selected_eval_window=this.value,p.fetchDataUpdateDisplay(!0,!0)})),$("#predeval_plot_type").on("change",(function(){p.state.selected_plot_type=this.value,p.fetchDataUpdateDisplay(!1,!1)})),$("#predeval_disaggregate_by").on("change",(function(){p.state.selected_disaggregate_by=this.value,p.fetchDataUpdateDisplay(!0,!1)})),$("#predeval_metric").on("change",(function(){p.state.selected_metric=this.value,p.fetchDataUpdateDisplay(!1,!1)})),$('button[data-bs-toggle="tab"]').on("shown.bs.tab",(function(e){"predeval_plot_tab"===e.target.id?(p.updatePlot(),$("#predeval_options_plot").fadeIn()):$("#predeval_options_plot").fadeOut()}))},fetchDataUpdateDisplay(e,t){if(e){const a=[this.fetchScores(t)];console.debug(`fetchDataUpdateDisplay(${e}): waiting on promises`),Promise.all(a).then((t=>{console.debug(`fetchDataUpdateDisplay(${e}): Promise.all() done. updating display`,t),this.updateDisplay()}))}else console.debug(`fetchDataUpdateDisplay(${e}): updating display`),this.updateDisplay()},fetchScores(e){const t=[this.fetchScoresTableOrPlot(!1)];return e&&t.push(this.fetchScoresTableOrPlot(!0)),Promise.all(t).then((e=>console.debug("fetchScores(): Promise.all() done"))).catch((e=>console.error(`fetchScores(): error: ${e.message}`)))},fetchScoresTableOrPlot(e){const t=new RegExp("^interval_coverage_");let a;return e?(a="(None)",this.state.scores_table=[]):(a=this.state.selected_disaggregate_by,this.state.scores_plot=[]),this._fetchData(this.state.selected_target,this.state.selected_eval_window,a).then((a=>{for(const e of a.columns)if(!["model_id","n",this.state.selected_disaggregate_by].includes(e))for(let s=0;s<a.length;s++)a[s][e]=parseFloat(a[s][e]),t.test(e)&&(a[s][e]*=100);e?this.state.scores_table=a:this.state.scores_plot=a})).catch((t=>console.error(`fetchScoresTableOrPlot(${e}): error: ${t.message}`)))},updateDisplay(){console.log("updateDisplay(): entered"),this.updateTable(),this.updatePlot()},updateTable(){const e=this.state,t=$("#predeval_table_pane"),a=$('<table id="predeval_table" class="table table-sm table-striped table-bordered"></table>'),i=$("<thead></thead>"),l=$("<tbody></tbody>"),r=$("<tr></tr>"),d=$("<th></th>"),_=$("<td></td>"),g=this.state.sort_models_by;this.state.sort_models_direction>0?this.state.scores_table.sort(((e,t)=>s.ascending(o(e[g]),o(t[g])))):this.state.scores_table.sort(((e,t)=>s.descending(o(e[g]),o(t[g]))));const h=e.scores_table.columns;h.forEach((function(t){let a,s=t===e.sort_models_by,i=e.sort_models_direction;a=s?i>0?"bi bi-caret-up-fill":"bi bi-caret-down-fill":"bi bi-chevron-expand",r.append(d.clone().hover((function(){$(this).css("background-color","rgba(0,0,0,.075)").css("cursor","pointer"),$(this).find("i").addClass("text-primary")}),(function(){$(this).css("background-color","").css("cursor","default"),$(this).find("i").removeClass("text-primary")})).on("click",(function(){p.updateTableSorting(t)})).text(c(t)).prepend($(`<i class="bi ${a}" role="img" aria-label="Sort"></i>`)))})),i.append(r),a.append(i);for(let t=0;t<e.scores_table.length;t++){const a=$("<tr></tr>");for(let s=0;s<h.length;s++){const i=h[s];let l=e.scores_table[t][i];"model_id"!==i&&"n"!==i&&(l=l.toFixed(n(i))),a.append(_.clone().text(l))}l.append(a)}a.append(l),t.empty().append(a)},updateTableSorting(e){this.state.sort_models_by===e?this.state.sort_models_direction*=-1:(this.state.sort_models_by=e,this.state.sort_models_direction=1),this.updateTable()},updatePlot(){const e=document.getElementById("predeval_plotly_div");this.setXaxisTickvals();const t=this.getPlotlyData();let a=this.getPlotlyLayout();0===t.length&&(a={title:{text:"No score data found."}}),Plotly.react(e,t,a)},setXaxisTickvals(){let e=this.state.scores_plot.map((e=>e[this.state.selected_disaggregate_by]));if(Object.keys(this.state.task_id_text).includes(this.state.selected_disaggregate_by)){console.log("Disaggregating by task ID with text");const t=this.state.task_id_text[this.state.selected_disaggregate_by];e=e.map((e=>t[e]))}const t=[...new Set(e)].sort();this.state.xaxis_tickvals=t},getPlotlyLayout(){if(0===this.state.scores_plot.length)return{};let e;"Line plot"===this.state.selected_plot_type?e=c(this.state.selected_metric):"Heatmap"===this.state.selected_plot_type&&(e=null);let t={autosize:!0,showlegend:!0,title:{text:`${c(this.state.selected_metric)} by ${this.state.selected_disaggregate_by}`,xanchor:"center",yanchor:"top"},xaxis:{title:{text:this.state.disaggregate_by},tickvals:this.state.xaxis_tickvals,ticktext:this.state.xaxis_tickvals,categoryorder:"array",categoryarray:this.state.xaxis_tickvals,fixedrange:!1,automargin:!0},yaxis:{title:{text:e},fixedrange:!1,automargin:!0}};if("Line plot"===this.state.selected_plot_type)t.autosize=!0,$("#predeval_plotly_div").css("height","75vh");else if("Heatmap"===this.state.selected_plot_type){t.width="#predeval_plotly_div".width;const e=new Set(this.state.scores_plot.map((e=>e.model_id))).size,a=Math.max(200+20*e,.75*$(window).height());t.height=a,$("#predeval_plotly_div").css("height",a+"px")}return t},getPlotlyData(){return"Line plot"===this.state.selected_plot_type?this.getPlotlyDataLinePlot():"Heatmap"===this.state.selected_plot_type?this.getPlotlyDataHeatmap():void 0},getPlotlyDataLinePlot(){const e=this.state;let t=[];if(0===e.scores_plot.length)return t;const a=s.group(e.scores_plot,(e=>e.model_id));for(const[s,i]of a){let a=i.map((t=>t[e.selected_disaggregate_by]));if(Object.keys(e.task_id_text).includes(e.selected_disaggregate_by)){const t=e.task_id_text[e.selected_disaggregate_by];a=a.map((e=>t[e]))}const l=i.map((t=>t[e.selected_metric]));let o=a.map(((e,t)=>[e,l[t]]));o.sort(((t,a)=>e.xaxis_tickvals.indexOf(t[0])-e.xaxis_tickvals.indexOf(a[0])));const r={x:o.map((e=>e[0])),y:o.map((e=>e[1])),mode:"lines+markers",type:"scatter",name:s,hovermode:!1,hovertemplate:`model: %{data.name}<br>${e.selected_disaggregate_by}: %{x}<br>${c(this.state.selected_metric)}: %{y:.${n(this.state.selected_metric)}f}<extra></extra>`,opacity:.7};t.push(r)}return t},getPlotlyDataHeatmap(){console.log("getPlotlyDataHeatmap(): entered");const e=this.state,t=new RegExp("^interval_coverage_").test(e.selected_metric),a=new RegExp("_scaled_relative_skill$").test(e.selected_metric);let i,l,o,d,p,_=[];if(0===e.scores_plot.length)return _;const g=s.min(e.scores_plot,(t=>t[e.selected_metric])),h=s.max(e.scores_plot,(t=>t[e.selected_metric]));if(t){i=0,p=`.${n(this.state.selected_metric)}f`,o=s.scaleSequential(s.interpolateRdBu);const t=[0,1],a=r(e.selected_metric),d=Math.max(a,100-a);l=s.scaleLinear([a-d,a+d],t)}else{const t=s.min(e.scores_plot.filter((t=>t[e.selected_metric]>0)),(t=>t[e.selected_metric]));let r;if(i=t/2,p=`.${n(this.state.selected_metric)}f`,a){const e=s.scaleSequential(s.interpolateRdBu);o=t=>e(1-t),r=[0,1];const t=Math.max(1/(g+i),h+i);l=s.scaleLog([1/t,t],r)}else{const e=s.scaleSequential(s.interpolateViridis);o=t=>{return a=e(t),`rgb(${parseInt(a.substring(1,3),16)}, ${parseInt(a.substring(3,5),16)}, ${parseInt(a.substring(5,7),16)})`;var a},r=[0,1],l=s.scaleLog([g+i,h+i],r)}}const m=e.scores_plot.map((t=>l(t[e.selected_metric]+i))),b=[...new Set(m)].filter((e=>void 0!==e)).sort(((e,t)=>e-t)),v=s.scaleLinear([b[0],b[b.length-1]],[0,1]),u=b.map((e=>[v(e),o(e)]));d={colorscale:u,showscale:!0,colorbar:{tickmode:"array",tickvals:l.ticks().map((e=>l(e+i))),ticktext:l.ticks().map(l.tickFormat(12,p))}};const y=s.group(e.scores_plot,(e=>e.model_id));let f=e.xaxis_tickvals,$=Array.from(y.keys()),x=[],w=[];for(const[t,a]of y){let t=a.map((t=>t[e.selected_disaggregate_by]));if(Object.keys(e.task_id_text).includes(e.selected_disaggregate_by)){const a=e.task_id_text[e.selected_disaggregate_by];t=t.map((e=>a[e]))}const s=a.map((t=>l(t[e.selected_metric]+i))),o=a.map((t=>t[e.selected_metric]));let n=t.map(((e,t)=>[e,s[t],o[t]]));n.sort(((t,a)=>e.xaxis_tickvals.indexOf(t[0])-e.xaxis_tickvals.indexOf(a[0])));const r=e.xaxis_tickvals.map((e=>{const t=n.find((t=>t[0]===e));return t?t[1]:null})),d=e.xaxis_tickvals.map((e=>{const t=n.find((t=>t[0]===e));return t?t[2]:null}));x.push(r),w.push(d)}let k={x:f,y:$,z:x,customdata:w,type:"heatmap",hovertemplate:`${e.selected_disaggregate_by}: %{x}<br>model: %{y}<br>${c(this.state.selected_metric)}: %{customdata:.${n(this.state.selected_metric)}f}<extra></extra>`,hoverongaps:!1};return _.push({...k,...d}),_}},_=p;var g=a.A;export{g as default};