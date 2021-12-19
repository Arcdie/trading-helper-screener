(async () => {
  await require('./middlewares')();

  const migrations = require('./migrations');
  const experiments = require('./experiments');
  const initServices = require('./services');

  migrations();
  experiments();
  initServices();
})();
