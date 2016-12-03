var _ = require('lodash');
var moment = require('moment');

var config = require('../../core/util.js').getConfig();
var util = require('../../core/util.js');
var log = require(`${util.dirs().core}log`);

var handle = require('./handle');
var influxUtil = require('./util');

var Store = function(done) {
  _.bindAll(this);
  this.done = done;
  this.db = handle;
  this.price = 'N/A';
  this.marketTime = 'N/A';
  this.candleCache = [];
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
  this.price = candle.close; // used in adviceWriter
  this.marketTime = candle.start;

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
  done();
}

var processAdvice = function processAdvice (advice) {
  if (config.candleWriter.muteSoft && advice.recommendation === 'soft') {
    return;
  }

  log.debug(`Writing advice '${advice.recommendation}' to database.`);

  this.db.writeMeasurement (influxUtil.settings.adviceMeasurement, [{
    fields: {
      marketTime: this.marketTime,
      recommendation: advice.recommendation,
      price: this.price,
      portfolio: advice.portfolio
    },
    timestamp: moment().utc().unix()
  }],{
    precision: 's'
  }).catch(() => {
    return util.die('DB error at `Influxdb/writer/processAdvice`')
  });

  this.adviceCollection.insert(mAdvice);
}

if (config.adviceWriter.enabled) {
  log.debug('Enabling adviceWriter.');
  Store.prototype.processAdvice = processAdvice;
}

if (config.candleWriter.enabled) {
  log.debug('Enabling candleWriter.');
  Store.prototype.processCandle = processCandle;
}

module.exports = Store;
