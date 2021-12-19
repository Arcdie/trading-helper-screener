const redis = require('../../../libs/redis');
const log = require('../../../libs/logger')(module);

const getInstrumentTrend = async ({
  instrumentName,
}) => {
  try {
    if (!instrumentName) {
      return {
        status: false,
        message: 'No instrumentName',
      };
    }

    const keyInstrumentTrend = `INSTRUMENT:${instrumentName}:TREND`;
    const instrumentTrend = await redis.getAsync(keyInstrumentTrend);

    if (!instrumentTrend) {
      return {
        status: false,
        message: 'No InstrumentTrend',
      };

      // todo: added request to trading-helper
    }

    return {
      status: true,
      result: JSON.parse(instrumentTrend),
    };
  } catch (error) {
    log.error(error.message);

    return {
      status: false,
      message: error.response.data,
    };
  }
};

module.exports = {
  getInstrumentTrend,
};
