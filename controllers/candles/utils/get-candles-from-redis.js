const {
  isMongoId,
} = require('validator');

const redis = require('../../../libs/redis');
const log = require('../../../libs/logger')(module);

const {
  INTERVALS,
} = require('../constants');

const getCandlesFromRedis = async ({
  instrumentId,
  instrumentName,
  interval,
}) => {
  try {
    if (!instrumentId || !isMongoId(instrumentId.toString())) {
      return {
        status: false,
        message: 'No or invalid instrumentId',
      };
    }

    if (!instrumentName) {
      return {
        status: false,
        message: 'No instrumentName',
      };
    }

    if (!interval || !INTERVALS.get(interval)) {
      return {
        status: false,
        message: 'No or invalid interval',
      };
    }

    const intervalWithUpperCase = interval.toUpperCase();

    const keyInstrumentCandles = `INSTRUMENT:${instrumentName}:CANDLES_${intervalWithUpperCase}`;
    const candlesDocs = await redis.getAsync(keyInstrumentCandles);

    return {
      status: true,
      result: candlesDocs ? JSON.parse(candlesDocs) : [],
    };
  } catch (error) {
    log.error(error.message);

    return {
      status: true,
      message: error.message,
    };
  }
};

module.exports = {
  getCandlesFromRedis,
};
