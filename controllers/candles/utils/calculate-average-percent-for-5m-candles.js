const {
  isMongoId,
} = require('validator');

const redis = require('../../../libs/redis');
const log = require('../../../libs/logger')(module);

const {
  INTERVALS,
} = require('../../candles/constants');

const {
  PRICE_JUMPS_CONSTANTS,
} = require('../../strategies/constants');

const calculateAveragePercentFor5mCandles = async ({
  instrumentId,
  instrumentName,
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

    const intervalWithUpperCase = INTERVALS.get('5m').toUpperCase();

    const keyInstrumentCandles = `INSTRUMENT:${instrumentName}:CANDLES_${intervalWithUpperCase}`;
    let candlesDocs = await redis.getAsync(keyInstrumentCandles);

    if (!candlesDocs) {
      return { status: true };
    }

    const numberCandles = PRICE_JUMPS_CONSTANTS.NUMBER_CANDLES_FOR_CALCULATE_AVERAGE_PERCENT;

    candlesDocs = JSON.parse(candlesDocs).slice(0, numberCandles + 1);

    if (candlesDocs.length < numberCandles) {
      const message = `Instrument ${instrumentName} has less candles than required`;

      return {
        status: false,
        message,
      };
    }

    let averagePercent = 0;

    candlesDocs.forEach(candle => {
      const [open, close, low, high] = candle.data;
      const isLong = close > open;

      const differenceBetweenPrices = isLong ? high - open : open - low;
      const percentPerPrice = 100 / (open / differenceBetweenPrices);

      averagePercent += percentPerPrice;
    });

    averagePercent = parseFloat((averagePercent / numberCandles).toFixed(2));

    const keyCandlesAverage = `INSTRUMENT:${instrumentName}:CANDLES_${intervalWithUpperCase}:AVERAGE_VALUE`;

    await redis.setAsync([
      keyCandlesAverage,
      averagePercent,
    ]);

    return {
      status: true,
      result: averagePercent,
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
  calculateAveragePercentFor5mCandles,
};
