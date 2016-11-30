var _ = require('lodash');
var async = require('async');
var fs = require('fs');
var toml = require('toml');

var util = require(__dirname + '/util');

var log = require(util.dirs().core + 'log');

var config = util.getConfig();
var dirs = util.dirs();
var pluginDir = util.dirs().plugins;
var gekkoMode = util.gekkoMode();

var pluginHelper = {
  // Checks whether we can load a module

  // @param Object plugin
  //    plugin config object
  // @return String
  //    error message if we can't
  //    use the module.
  cannotLoad: function(plugin) {

    // verify plugin dependencies are installed
    if(_.has(plugin, 'dependencies'))
      var error = false;

      _.each(plugin.dependencies, function(dep) {
        try {
          var a = require(dep.module);
        }
        catch(e) {
          log.error('ERROR LOADING DEPENDENCY', dep.module);

          if(!e.message) {
            log.error(e);
            util.die();
          }

          if(!e.message.startsWith('Cannot find module'))
            return util.die(e);

          error = [
            'The plugin',
            plugin.slug,
            'expects the module',
            dep.module,
            'to be installed.',
            'However it is not, install',
            'it by running: \n\n',
            '\tnpm install',
            dep.module + '@' + dep.version
          ].join(' ');
        }
      });

    return error;
  },
  // loads a plugin
  //
  // @param Object plugin
  //    plugin config object
  // @param Function next
  //    callback
  load: function(plugin, next) {
    // plugin settings can be either part of the main config OR a seperate
    // toml configuration file. In case of the toml config file we need to
    // parse and attach to main config object

    if(config[plugin.slug]) {
      log.warn('\t', 'Config already has', plugin.slug, 'parameters. Ignoring toml file');
    } else {
      var tomlFile = dirs.config + 'plugins/' + plugin.slug + '.toml';
      if(!fs.existsSync(tomlFile)) {
        log.warn('\t', plugin.slug, 'toml configuration file not found.');
        return;
      }
      var rawSettings = fs.readFileSync(tomlFile);
      config[plugin.slug] = toml.parse(rawSettings);
    }

    plugin.config = config[plugin.slug];

    if(!plugin.config)
      log.warn(
        'unable to find',
        plugin.name,
        'in the config. Is your config up to date?'
      );

    if(!plugin.config || !plugin.config.enabled)
      return next();

    if(!_.contains(plugin.modes, gekkoMode)) {
      log.warn(
        'The plugin',
        plugin.name,
        'does not support the mode',
        gekkoMode + '.',
        'It has been disabled.'
      )
      return next();
    }

    log.info('Setting up:');
    log.info('\t', plugin.name);
    log.info('\t', plugin.description);

    var cannotLoad = pluginHelper.cannotLoad(plugin);
    if(cannotLoad)
      return next(cannotLoad);

    if(plugin.path)
      var Constructor = require(pluginDir + plugin.path(plugin.config));
    else
      var Constructor = require(pluginDir + plugin.slug);

    if(plugin.async) {
      var instance = new Constructor(util.defer(function(err) {
        next(err, instance);
      }), plugin);
      instance.meta = plugin;
    } else {
      var instance = new Constructor(plugin);
      instance.meta = plugin;
      _.defer(function() {
        next(null, instance);
      });
    }

    if(!plugin.silent)
      log.info('\n');
  }
}

module.exports = pluginHelper;
