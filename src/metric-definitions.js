/**
 * Metric definitions and details links for the glossary.
 * Each entry maps an internal metric name to a [definition, detailsLink] tuple.
 * Set detailsLink to null if no details link is available.
 */
export const metricDefinitions = {
    'ae_median': ['Absolute error of the median. Calculated as the magnitude of the observed value minus the median prediction. Smaller values are better.',
        'https://epiforecasts.io/scoringutils/reference/ae_median_quantile.html'],
    'ae_median_scaled_relative_skill': ['Relative skill of the absolute error of the median, scaled in comparison to the baseline model. Compares Model M\'s average absolute error of the median to all other models\', for all possible forecasts, then divides that by the same score for the baseline for easy comparison. Smaller values are better, and the baseline always has a value of 1.0.',
        'https://epiforecasts.io/scoringutils/reference/get_pairwise_comparisons.html'],
    'ae_point': ['Absolute error of the point forecast. Calculated as the magnitude of the observed value minus the point prediction. Smaller values are better.',
        'https://epiforecasts.io/scoringutils/reference/get_metrics.forecast_point.html'],
    'ae_point_scaled_relative_skill': ['Relative skill of the absolute error of point forecasts, scaled in comparison to the baseline model. Compares Model M\'s average absolute error of point forecasts to all other models\', for all possible forecasts, then divides that by the same score for the baseline for easy comparison. Smaller values are better, and the baseline always has a value of 1.0.',
        'https://epiforecasts.io/scoringutils/reference/get_pairwise_comparisons.html'],
    'interval_coverage_50': ['50% interval coverage. Checks whether the observed value is captured within the bounds of the 50% prediction interval. Closer to nominal (50%) coverage is better.',
        'https://epiforecasts.io/scoringutils/reference/interval_coverage.html'],
    'interval_coverage_95': ['95% interval coverage. Checks whether the observed value is captured within the bounds of the 95% prediction interval. Closer to nominal (95%) coverage is better.',
        'https://epiforecasts.io/scoringutils/reference/interval_coverage.html'],
    'se_point': ['Squared error of point forecasts. Calculated as the observed value minus the point prediction, squared. Smaller values are better.',
        'https://epiforecasts.io/scoringutils/reference/get_metrics.forecast_point.html'],
    'se_point_scaled_relative_skill': ['Relative skill of the squared error of point forecasts, scaled in comparison to the baseline model. Compares Model M\'s average squared error of point forecasts to all other models\', for all possible forecasts, then divides that by the same score for the baseline for easy comparison. Smaller values are better, and the baseline always has a value of 1.0.',
        'https://epiforecasts.io/scoringutils/reference/get_pairwise_comparisons.html'],
    'wis': ['Weighted interval score. The averaged interval scores (IS) of every prediction interval, plus the difference between the observed value and median. The interval score is the sum of three components: overprediction, underprediction, and dispersion. Lower is better.',
        'https://epiforecasts.io/scoringutils/reference/wis.html'],
    'wis_scaled_relative_skill': ['Relative skill of the weighted interval score, scaled in comparison to the baseline model. Compares Model M\'s average WIS to all other models\', for all possible forecasts, then divides that by the same score for the baseline for easy comparison. Smaller values are better, and the baseline always has a value of 1.0.',
        'https://epiforecasts.io/scoringutils/reference/get_pairwise_comparisons.html'],
};
