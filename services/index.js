const log = require('../libs/logger')(module);

require('../websocket/websocket-server');
const memoryUsage = require('./memory-usage');
const binanceScreenerProcesses = require('./binance-screener');

module.exports = async () => {
  try {
    await binanceScreenerProcesses();

    // check memory
    /*
    setInterval(() => {
      memoryUsage();
    }, 10 * 1000); // 10 seconds
    // */
  } catch (error) {
    log.warn(error.message);
    return false;
  }
};
