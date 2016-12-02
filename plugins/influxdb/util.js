var config = require('../../core/util.js').getConfig();

var watch = config.watch;
var settings = {
  exchange: watch.exchange,
  pair: [watch.currency, watch.asset],
  historyMeasurement: `${watch.exchange}_${watch.currency}_${watch.asset}_candles`,
  adviceMeasurement: `${watch.exchange}_${watch.currency}_${watch.asset}_advices`
}

module.exports = {
  settings: settings
}
