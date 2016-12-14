// If you want to use your own trading methods you can
// write them here. For more information on everything you
// can use please refer to this document:
//
// https://github.com/askmike/gekko/blob/stable/docs/trading_methods.md

var log = require('../core/log.js');

var config = require('../core/util.js').getConfig();
var settings = config['talib-custom'];

// Let's create our own method
var method = {};

// Prepare everything our method needs
method.init = function() {
  this.name = 'talib-custom'
  // keep state about the current trend
  // here, on every new candle we use this
  // state object to check if we need to
  // report it.
  this.trend = 'none';

  // how many candles do we need as a base
  // before we can start giving advice?
  this.requiredHistory = config.tradingAdvisor.historySize;

  var bbandsTalibSettings = settings.bbandsParameters;

  // define the indicators we need
  this.addTalibIndicator('mybbands', 'bbands', bbandsTalibSettings);

  // list displayed output
  this.outputs = {
    upperBand: 0,
    middleBand: 0,
    lowerBand: 0
  };
}

// What happens on every new candle?
method.update = function(candle) {
  var result = this.talibIndicators.mybbands.result;
  this.outputs.upperBand = parseFloat(result.outRealUpperBand);
  this.outputs.middleBand = parseFloat(result.outRealMiddleBand);
  this.outputs.lowerBand = parseFloat(result.outRealLowerBand);
}


method.log = function() {
  var digits = 8;

  log.debug('calculated Talib Bbands properties for candle:');
  log.debug('\t', 'UpperBands:', this.outputs.upperBand.toFixed(digits));
  log.debug('\t', 'MiddleBands:', this.outputs.middleBand.toFixed(digits));
  log.debug('\t', 'LowerBands:', this.outputs.lowerBand.toFixed(digits));
  log.debug('\t', 'trend:', this.trend);
}

// Based on the newly calculated
// information, check if we should
// update or not.
method.check = function() {

  // if( && this.trend !== 'short') {
  //   this.trend = 'short';
  //   this.advice('short');
  //
  // } else if( && this.trend !== 'long'){
  //   this.trend = 'long';
  //   this.advice('long');
  //
  // }
}

module.exports = method;
