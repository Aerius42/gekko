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
  }]
});

client.getDatabaseNames().then(names => {
  if (!names.includes(config.adapters.influxdb.dbName)) {
    return client.createDatabase(config.adapters.influxdb.dbName);
  }
}).catch(err => {
  console.error('Error Influx database: error connection or error creating database');
});

module.exports = client;
