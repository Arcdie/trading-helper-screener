const redis = require('../../../libs/redis');
const log = require('../../../libs/logger')(module);

const {
  PERIODS,
} = require('../constants');

const {
  INTERVALS,
} = require('../../candles/constants');

const updateMovingAverage = async ({
  period,
  timeframe,
  instrumentName,
}, data = []) => {
  try {
    if (!instrumentName) {
      return {
        status: false,
        message: 'No instrumentName',
      };
    }

    if (!period || !PERIODS.get(period)) {
      log.warn('No or invalid period');
      return false;
    }

    if (!timeframe || !INTERVALS.get(timeframe)) {
      return {
        status: false,
        message: 'No or invalid timeframe',
      };
    }

    if (!data || !data.length) {
      return {
        status: false,
        message: 'No or empty data',
      };
    }

    const key = `INSTRUMENT:${instrumentName}:MA_${timeframe.toUpperCase()}_${period.toUpperCase()}`;

    await redis.setAsync([
      key,
      JSON.stringify(data),
    ]);

    return {
      status: true,
    };
  } catch (error) {
    log.warn(error.message);

    return {
      status: false,
      message: error.message,
    };
  }
};

module.exports = {
  updateMovingAverage,
};
