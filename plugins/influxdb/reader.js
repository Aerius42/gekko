var _ = require('lodash');
var moment = require('moment');
var util = require('../../core/util.js');
var config = util.getConfig();
var log = require(util.dirs().core + 'log');

var handle = require('./handle');
var influxUtil = require('./util');

var Reader = function() {
  _.bindAll(this);
  this.db = handle;
}

// returns the furtherst point (up to `from`) in time we have valid data from
Reader.prototype.mostRecentWindow = function(from, to, next) {
  console.log('A0');
  from = from.unix();
  to = to.unix();

  var maxAmount = to - from + 1;

  this.db.query(`
    select start from ${influxUtil.settings.historyMeasurement}
    where time <= ${to}s and time >= ${from}s
    order by start desc
  `).then( result => {
    // no candles are available
    if(_.length(result) === 0) {
      return next(false);
    } else if (_.length(result) === maxAmount) {
      // full history is available!
      return next({
        from: from,
        to: to
      });
    }
    // we have at least one gap, figure out where
    const mostRecent = _.first(result).start;
    const gapIndex = _.findIndex(result, function(r, i) {
      return r.start !== mostRecent - i * 60;
    });
    // if there was no gap in the records, but
    // there were not enough records.
    if(gapIndex === -1) {
      const leastRecent = _.last(result).start;
      return next({
        from: leastRecent,
        to: mostRecent
      });
    }
    // else return mostRecent and the
    // the minute before the gap
    return next({
      from: result[ gapIndex - 1 ].start,
      to: mostRecent
    });
  }, () => {
    return util.die('DB error at `mostRecentWindow`');
  });
}

Reader.prototype.tableExists = function(name, next) {
  this.db.getMeasurements().then(names => {
    if(names.includes(influxUtil.settings.historyMeasurement)) {
      return next(null, true);
    } else {
      return util.die('DB error at `tableExists`');
    }
  });
}

Reader.prototype.get = function(from, to, what, next) {
  if(what === 'full'){
    what = '*';
  }

  this.db.query(`
    select ${what} from ${influxUtil.settings.historyMeasurement}
    where time <= ${to}s and time >= ${from}s
    order by time asc
  `).then(result => {
    return next(null, result);
  }, () => {
    return util.die('DB error at `Influxdb/reader/get`')
  });
}

Reader.prototype.count = function(from, to, next) {
  this.db.query(`
    select count(start) from ${influxUtil.settings.historyMeasurement}
    where time <= ${to}s and time >= ${from}s
  `).then(result => {
    if(typeof _.first(result) === 'undefined') {
      return next(null, 0);
    }
    let count = _.first(result).count;
    if(typeof count === 'undefined') {
      return next(null, 0);
    }
    return next(null, count);
  }, () => {
    return util.die('DB error at `Influxdb/reader/countTotal`')
  });
}

Reader.prototype.countTotal = function(next) {
  this.db.query(`
    select count(start) from ${influxUtil.settings.historyMeasurement}
  `).then(result => {
    return next(null, _.first(result).count);
  }, () => {
    return util.die('DB error at `Influxdb/reader/countTotal`')
  });
}

Reader.prototype.getBoundry = function(next) {
  this.db.query(`
    select first(start) from ${influxUtil.settings.historyMeasurement}
  `).then(
    result => {
      return moment(_.first(result).time.getTime()).unix();
    }, () => {
      return util.die('DB error at `Influxdb/reader/getBoundry`')
    }
  ).then(
    first => {
      return this.db.query(
        `select last(start) from ${influxUtil.settings.historyMeasurement}`
      ).then(
        result => {
          let last = moment(_.first(result).time.getTime()).unix();
          return next(null, { first: first, last: last });
        }, () => {
          return util.die('DB error at `Influxdb/reader/getBoundry`')
        }
      );
    }
  );
}

Reader.prototype.close = function() {
  this.db = null;
}

module.exports = Reader;
