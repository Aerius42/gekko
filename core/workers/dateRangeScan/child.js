var util = require(__dirname + '/../../util');

var dirs = util.dirs();
var ipc = require('relieve').IPCEE(process);

var config;

ipc.on('start', config => {

  // force correct gekko env
  util.setGekkoEnv('child-process');

  // force disable debug
  config.debug = false;

  // persist config
  util.setConfig(config);

  var scan = require(dirs.tools + 'dateRangeScanner');
  scan(
    (err, ranges) => {
      ipc.send('ranges', ranges)
      process.exit(0);
    }
  );
});

