var mongojs = require('mongojs');
var mongoUtil = require('./util');

var util = require('../../core/util.js');
var config = util.getConfig();
var dirs = util.dirs();

// verify the correct dependencies are installed
var pluginHelper = require(`${dirs.core}pluginUtil`);
var pluginMock = {
  slug: 'mongodb adapter',
  dependencies: config.adapters.mongodb.dependencies
}

// exit if plugin couldn't be loaded
var cannotLoad = pluginHelper.cannotLoad(pluginMock);
if (cannotLoad) {
  util.die(cannotLoad);
}

var mode = util.gekkoMode();

var collections = [
  mongoUtil.settings.historyCollection,
  mongoUtil.settings.adviceCollection,
  mongoUtil.settings.adviceBacktestCollection
]

var connection = mongojs(config.adapters.mongodb.connectionString, collections);
var collection = connection.collection(mongoUtil.settings.historyCollection);

if (mode === 'backtest') {
  var pair = mongoUtil.settings.pair.join('_');

  // TODO: drop backtest advices collection if exists

  collection.find({ pair }).toArray((err, docs) => { // check if we've got any records
    if (err) {
      util.die(err);
    }
    if (docs.length === 0) {
      util.die(`History table for ${config.watch.exchange} with pair ${pair} is empty.`);
    }
  })
}

collection.createIndex({ start: 1, pair: 1 }, { unique: true }); // create unique index on "time" and "pair"

module.exports = connection;
