module.exports = (async () => {
  require('./utils/set-env');
  await require('./utils/set-models')();
  await require('./utils/set-constants')();

  require('../libs/redis');
  require('../libs/mongodb');

  const log = require('../libs/logger')(module);

  process.on('uncaughtException', (err) => {
    if (err.code === 'ECONNREFUSED') {
      return true;
    }

    log.error(err);
    process.exit(1);
  });
});
