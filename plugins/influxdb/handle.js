var Influx = require('influx');
var influxUtil = require('./util');

var util = require('../../core/util.js');
var config = util.getConfig();
var dirs = util.dirs();

var log = require(util.dirs().core + 'log');

var adapter = config.adapters.influxdb;

// verify the correct dependencies are installed
var pluginHelper = require(`${dirs.core}pluginUtil`);
var pluginMock = {
  slug: 'influxdb adapter',
  dependencies: config.adapters.influxdb.dependencies
};

var cannotLoad = pluginHelper.cannotLoad(pluginMock);
if(cannotLoad){
  util.die(cannotLoad);
}

var plugins = require(util.dirs().gekko + 'plugins');

var version = adapter.version;

var mode = util.gekkoMode();

var client = new Influx.InfluxDB({
  host: config.adapters.influxdb.host,
  port: config.adapters.influxdb.port,
  database: config.adapters.influxdb.dbName,
  username: config.adapters.influxdb.username,
  password: config.adapters.influxdb.password,
  schema: [{
    measurement: influxUtil.settings.historyMeasurement,
    fields: {
      start: Influx.FieldType.INTEGER,
      open: Influx.FieldType.FLOAT,
      high: Influx.FieldType.FLOAT,
      low: Influx.FieldType.FLOAT,
      close: Influx.FieldType.FLOAT,
      vwp: Influx.FieldType.FLOAT,
      volume: Influx.FieldType.FLOAT,
      trades: Influx.FieldType.FLOAT
    },
    tags: []
  },{
    measurement: influxUtil.settings.adviceMeasurement,
    fields: {
      marketTime: Influx.FieldType.INTEGER,
      recommendation: Influx.FieldType.STRING,
      price: Influx.FieldType.FLOAT,
      portfolio: Influx.FieldType.STRING
    },
    tags: []
  },{
    measurement: influxUtil.settings.adviceBacktestMeasurement,
    fields: {
      marketTime: Influx.FieldType.INTEGER,
      recommendation: Influx.FieldType.STRING,
      price: Influx.FieldType.FLOAT,
      portfolio: Influx.FieldType.STRING
    },
    tags: []
  }]
});

client.getDatabaseNames().then(names => {
  if (names.includes(config.adapters.influxdb.dbName)) {
    if (mode === 'backtest') {
      client.getMeasurements(config.adapters.influxdb.dbName).then( measurements => {
        if(measurements.includes(influxUtil.settings.adviceBacktestMeasurement)) {
          log.info('Old backtest advices detected in database: deletion');
          client.dropMeasurement(influxUtil.settings.adviceBacktestMeasurement, config.adapters.influxdb.dbName);
        }
      });
    }
  } else {
    if (mode === 'backtest') {
      util.die(`History table for ${config.watch.exchange} with pair ${influxUtil.settings.pair} is empty.`);
    }
    client.createDatabase(config.adapters.influxdb.dbName);
  }
}).catch(err => {
  util.die(`Error Influx database: error connection or creating database`);
});

module.exports = client;
