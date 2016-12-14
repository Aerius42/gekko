var config = require('../../core/util.js').getConfig();

var watch = config.watch;
var settings = {
  exchange: watch.exchange,
  pair: [watch.currency, watch.asset],
  historyMeasurement: `${watch.exchange}_${watch.currency}_${watch.asset}_candles`,
  adviceMeasurement: `${watch.exchange}_${watch.currency}_${watch.asset}_advices`,
  adviceParamMeasurement: `${watch.exchange}_${watch.currency}_${watch.asset}_advices_param`,
  adviceBacktestMeasurement: `${watch.exchange}_${watch.currency}_${watch.asset}_backtest_advices`,
  adviceBacktestParamMeasurement: `${watch.exchange}_${watch.currency}_${watch.asset}_backtest_advices_param`
}

module.exports = {
  settings: settings
}
