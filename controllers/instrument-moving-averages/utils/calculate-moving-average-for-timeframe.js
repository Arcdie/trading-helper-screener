const {
  isMongoId,
} = require('validator');

const log = require('../../../libs/logger')(module);

const {
  updateMovingAverage,
} = require('./update-moving-average');

const {
  calculateMovingAverage,
} = require('./calculate-moving-average');

const {
  getCandlesFromRedis,
} = require('../../candles/utils/get-candles-from-redis');

const {
  PERIODS,
} = require('../constants');

const {
  INTERVALS,
} = require('../../candles/constants');

const calculateMovingAverageForTimeframe = async ({
  timeframe,
  instrumentId,
  instrumentName,
}) => {
  try {
    if (!instrumentName) {
      return {
        status: false,
        message: 'No instrumentName',
      };
    }

    if (!instrumentId || !isMongoId(instrumentId.toString())) {
      return {
        status: false,
        message: 'No or invalid instrumentId',
      };
    }

    if (!timeframe || !INTERVALS.get(timeframe)) {
      return {
        status: false,
        message: 'No or invalid timeframe',
      };
    }

    const resultGetCandles = await getCandlesFromRedis({
      instrumentId,
      instrumentName,
      interval: timeframe,
    });

    if (!resultGetCandles || !resultGetCandles.status) {
      const message = resultGetCandles.message || 'Cant getCandlesFromRedis';
      log.warn(message);

      return {
        status: false,
        message,
      };
    }

    const candlesDocs = resultGetCandles.result;

    if (!candlesDocs || !candlesDocs.length) {
      return { status: true };
    }

    const data = candlesDocs
      .reverse().map(doc => ({
        value: doc.close,
        time: doc.time,
      }));

    const resultCalculateShortMA = calculateMovingAverage(data, PERIODS.get('short'));
    const resultCalculateMediumMA = calculateMovingAverage(data, PERIODS.get('medium'));

    if (resultCalculateShortMA && resultCalculateShortMA.length) {
      const resultUpdate = await updateMovingAverage({
        timeframe,
        instrumentName,
        period: PERIODS.get('short'),
      }, resultCalculateShortMA);

      if (!resultUpdate || !resultUpdate.status) {
        log.warn(resultUpdate.message || 'Cant updateMovingAverage (Short)');
      }
    }

    if (resultCalculateMediumMA && resultCalculateMediumMA.length) {
      const resultUpdate = await updateMovingAverage({
        timeframe,
        instrumentName,
        period: PERIODS.get('medium'),
      }, resultCalculateMediumMA);

      if (!resultUpdate || !resultUpdate.status) {
        log.warn(resultUpdate.message || 'Cant updateMovingAverage (Medium)');
      }
    }

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
  calculateMovingAverageForTimeframe,
};
