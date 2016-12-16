var _ = require('lodash');
var moment = require('moment');

var config = require('../../core/util.js').getConfig();
var util = require('../../core/util.js');
var log = require(`${util.dirs().core}log`);

var handle = require('./handle');
var influxUtil = require('./util');

var mode = util.gekkoMode();

var Store = function(done) {
  _.bindAll(this);
  this.done = done;
  this.db = handle;
  this.price = 'N/A';
  this.marketTime = 'N/A';
  this.candleCache = [];
  this.paramsCache = [];
  this.adviceMeasurement = mode === 'backtest' ? influxUtil.settings.adviceBacktestMeasurement : influxUtil.settings.adviceMeasurement;
  this.adviceParamMeasurement = mode === 'backtest' ? influxUtil.settings.adviceBacktestParamMeasurement : influxUtil.settings.adviceParamMeasurement;
  done();
}

Store.prototype.writeCandles = function() {
  if(_.isEmpty(this.candleCache)) {
    return;
  }

  this.db.writeMeasurement (influxUtil.settings.historyMeasurement, this.candleCache, {
    precision: 's'
  }).catch(err => {
    log.info(err);
    return util.die('DB error at `Influxdb/writer/writeCandles`');
  });

  this.candleCache = [];
}

var processCandle = function(candle, done) {
  // because we might get a lot of candles
  // in the same tick, we rather batch them
  // up and insert them at once at next tick.

  if (config.candleWriter.enabled) {
    this.candleCache.push({
      fields: {
        start: candle.start.unix(),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        vwp: candle.vwp,
        volume: candle.volume,
        trades: candle.trades
      },
      timestamp: candle.start.unix()
    });
    _.defer(this.writeCandles);
  }
  done();
}

Store.prototype.writeTradingAdvisorParams = function() {
  if(_.isEmpty(this.paramsCache)) {
    return;
  }
  this.db.writeMeasurement (this.adviceParamMeasurement, this.paramsCache, {
    precision: 's'
  }).catch(err => {
    return util.die('DB error at `Influxdb/writer/processAdvice (writing params)`');
  });

  this.paramsCache = [];
}

var processAdvice = function(advice) {

  // Writing tradingAdvisor params
  if (config.tradingAdvisor.writingParamsEnabled) {

    if (util.checkNaN(advice.params)) {
      log.warn(`NaN detected, skip values`);
    } else {
      this.paramsCache.push({
        fields: _.clone(advice.params),
        timestamp: advice.time.unix()
      });
      _.defer(this.writeTradingAdvisorParams);
    }
  }

  // Check muteSoft
  if (config.adviceWriter.muteSoft && advice.recommendation === 'soft') return;

  // Writing advice
  log.debug(`Writing advice '${advice.recommendation}' to database.`);
  this.db.writeMeasurement ( this.adviceMeasurement, [{
    fields: {
      marketTime: advice.time.unix(),
      recommendation: advice.recommendation,
      price: advice.candle.close,
      portfolio: advice.portfolio
    },
    timestamp: advice.time.unix()
  }],{
    precision: 's'
  }).catch(err => {
    return util.die('DB error at `Influxdb/writer/processAdvice (writing advice)`');
  });
}

if (config.adviceWriter.enabled) {
  log.debug('\t', 'Enabling adviceWriter.');
  Store.prototype.processAdvice = processAdvice;
}

if (config.candleWriter.enabled) {
  if(mode === 'backtest') {
    log.warn('CandleWriter disabled: not support in backtest mode');
    config.candleWriter.enabled = false;
  } else {
    log.debug('Enabling candleWriter.');
    Store.prototype.processCandle = processCandle;
  }
}

module.exports = Store;
