var _ = require('lodash');
var moment = require('moment');
var util = require('../../core/util');
var config = util.getConfig();
var dirs = util.dirs();
var log = require(dirs.core + 'log');

var ENV = util.gekkoEnv();

if(config.tradingAdvisor.talib.enabled) {
  // verify talib is installed properly
  var pluginHelper = require(dirs.core + 'pluginUtil');
  var pluginMock = {
    slug: 'tradingAdvisor',
    dependencies: [{
      module: 'talib',
      version: config.tradingAdvisor.talib.version
    }]
  };

  var cannotLoad = pluginHelper.cannotLoad(pluginMock);
  if(cannotLoad)
    util.die(cannotLoad);

  var talib = require(dirs.core + 'talib');
}

var indicatorsPath = dirs.methods + 'indicators/';

var Indicators = {
  MACD: {
    factory: require(indicatorsPath + 'MACD'),
    input: 'price'
  },
  EMA: {
    factory: require(indicatorsPath + 'EMA'),
    input: 'price'
  },
  DEMA: {
    factory: require(indicatorsPath + 'DEMA'),
    input: 'price'
  },
  PPO: {
    factory: require(indicatorsPath + 'PPO'),
    input: 'price'
  },
  LRC: {
    factory: require(indicatorsPath + 'LRC'),
    input: 'price'
  },
  SMA: {
    factory: require(indicatorsPath + 'SMA'),
    input: 'price'
  },

  RSI: {
    factory: require(indicatorsPath + 'RSI'),
    input: 'candle'
  },
  TSI: {
    factory: require(indicatorsPath + 'TSI'),
    input: 'candle'
  },
  UO: {
    factory: require(indicatorsPath + 'UO'),
    input: 'candle'
  },
  CCI: {
    factory: require(indicatorsPath + 'CCI'),
    input: 'candle'
  }
};

var allowedIndicators = _.keys(Indicators);
var allowedTalibIndicators = _.keys(talib);

var Base = function() {
  _.bindAll(this);

  // properties
  this.age = 0;
  this.processedTicks = 0;
  this.setup = false;

  // defaults
  this.requiredHistory = 0;
  this.priceValue = 'close';
  this.indicators = {};
  this.talibIndicators = {};
  this.asyncTick = false;
  this.candlePropsCacheSize = 1000;

  this.candleProps = {
    open: [],
    high: [],
    low: [],
    close: [],
    volume: []
  };

  // keep time for trading advisor ouputs
  this.candleCache = [];

  // make sure we have all methods
  _.each(['init', 'check'], function(fn) {
    if(!this[fn])
      util.die('No ' + fn + ' function in this trading method found.')
  }, this);

  if(!this.update)
    this.update = function() {};

  // let's run the implemented starting point
  this.init();

  // should be set up now, check some things
  // to make sure everything is implemented
  // correctly.
  if(!this.name)
    log.warn('Warning, trading method has no name');

  if(!config.debug || !this.log)
    this.log = function() {};

  this.setup = true;

  if(_.size(this.talibIndicators))
    this.asyncTick = true;
}

// teach our base trading method events
util.makeEventEmitter(Base);

Base.prototype.tick = function(candle) {
  this.age++;
  this.candleCache.push(candle);

  if(this.asyncTick) {
    this.candleProps.open.push(candle.open);
    this.candleProps.high.push(candle.high);
    this.candleProps.low.push(candle.low);
    this.candleProps.close.push(candle.close);
    this.candleProps.volume.push(candle.volume);

    if(this.age > this.candlePropsCacheSize) {
      this.candleProps.open.shift();
      this.candleProps.high.shift();
      this.candleProps.low.shift();
      this.candleProps.close.shift();
      this.candleProps.volume.shift();
    }
  }

  // update all indicators
  var price = candle[this.priceValue];
  _.each(this.indicators, function(i) {
    if(i.input === 'price')
      i.update(price);
    if(i.input === 'candle')
      i.update(candle);
  },this);

  // update the trading method
  if(!this.asyncTick || this.requiredHistory > this.age) {
    this.propogateTick();
  } else {
    var next = _.after(
      _.size(this.talibIndicators),
      this.propogateTick
    );

    var basectx = this;

    // handle result from talib
    var talibResultHander = function(err, result) {
      if(err)
        util.die('TALIB ERROR:', err);

      // fn is bound to indicator
      this.result = _.mapValues(result, v => _.last(v));
      next();
    }

    // handle result from talib
    _.each(
      this.talibIndicators,
      indicator => indicator.run(
        basectx.candleProps,
        talibResultHander.bind(indicator)
      )
    );
  }

  this.propogateCustomCandle(candle);
}

// if this is a child process the parent might
// be interested in the custom candle.
if(ENV !== 'child-process') {
  Base.prototype.propogateCustomCandle = _.noop;
} else {
  Base.prototype.propogateCustomCandle = function(candle) {
    process.send({
      type: 'candle',
      candle: candle
    });
  }
}

Base.prototype.propogateTick = function() {

  this.candle = this.candleCache.shift();
  this.lastPrice = this.candle.close;

  // Synchronize time advice
  this.advice.time = moment(this.candle.start).add(config.tradingAdvisor.candleSize,'m');

  this.update(this.candle);
  this.advice();

  if(this.requiredHistory <= this.age) {
    if(config.tradingAdvisor.logEnable)
      this.log();
    this.check(this.candle);
  }
  this.processedTicks++;

  // are we totally finished
  var done = this.age === this.processedTicks;
  if(done && this.finishCb)
    this.finishCb();
}

Base.prototype.addTalibIndicator = function(name, type, parameters) {
  if(!talib)
    util.die('Talib is not enabled');

  if(!_.contains(allowedTalibIndicators, type))
    util.die('I do not know the talib indicator ' + type);

  if(this.setup)
    util.die('Can only add talib indicators in the init method!');

  var basectx = this;

  this.talibIndicators[name] = {
    run: talib[type].create(parameters),
    result: NaN
  }
}

Base.prototype.addIndicator = function(name, type, parameters) {
  if(!_.contains(allowedIndicators, type))
    util.die('I do not know the indicator ' + type);

  if(this.setup)
    util.die('Can only add indicators in the init method!');

  this.indicators[name] = new Indicators[type].factory(parameters);

  // some indicators need a price stream, others need full candles
  this.indicators[name].input = Indicators[type].input;
}

Base.prototype.advice = function(newPosition) {
  var advice = 'soft';
  if(newPosition) {
    advice = newPosition;
  }

  this.emit('advice', {
    recommendation: advice,
    portfolio: 1,
    candle: this.candle,
    time: this.advice.time,
    lastPrice: this.lastPrice,
    params: this.advice.params
  });
}

// Because the trading method might be async we need
// to be sure we only stop after all candles are
// processed.
Base.prototype.finish = function(done) {
  if(!this.asyncTick)
    return done();

  if(this.age === this.processedTicks)
    return done();

  // we are not done, register cb
  // and call after we are..
  this.finishCb = done;
}

module.exports = Base;
