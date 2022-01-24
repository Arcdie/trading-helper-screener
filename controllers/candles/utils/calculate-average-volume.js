const {
  isMongoId,
} = require('validator');

const redis = require('../../../libs/redis');
const log = require('../../../libs/logger')(module);

const {
  INTERVALS,
} = require('../../candles/constants');

const {
  PRICE_ROLLBACKS_CONSTANTS,
} = require('../../strategies/constants');

const calculateAverageVolume = async ({
  instrumentId,
  instrumentName,

  timeframe,
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

    if (!timeframe || !INTERVALS.get(timeframe)) {
      return {
        status: false,
        message: 'No or invalid timeframe',
      };
    }

    const intervalWithUpperCase = INTERVALS.get(timeframe).toUpperCase();

    const keyInstrumentCandles = `INSTRUMENT:${instrumentName}:CANDLES_${intervalWithUpperCase}`;
    let candlesDocs = await redis.getAsync(keyInstrumentCandles);

    if (!candlesDocs) {
      return { status: true };
    }

    candlesDocs = JSON.parse(candlesDocs);

    const numberCandlesForVolume = timeframe === INTERVALS.get('5m') ?
      PRICE_ROLLBACKS_CONSTANTS.NUMBER_CANDLES_FOR_CALCULATE_AVERAGE_PERCENT_FOR_5M :
      PRICE_ROLLBACKS_CONSTANTS.NUMBER_CANDLES_FOR_CALCULATE_AVERAGE_PERCENT_FOR_1H;

    if (candlesDocs.length < numberCandlesForVolume) {
      const message = `Instrument ${instrumentName} has less candles than required`;

      return {
        status: false,
        message,
      };
    }

    let averageValueForVolume = 0;

    candlesDocs.forEach(candle => {
      averageValueForVolume += candle.volume;
    });

    averageValueForVolume = parseFloat((averageValueForVolume / numberCandlesForVolume).toFixed(2));

    const keyVolumeAverage = `INSTRUMENT:${instrumentName}:CANDLES_${intervalWithUpperCase}:AVERAGE_VOLUME_VALUE`;

    await redis.setAsync([
      keyVolumeAverage,
      averageValueForVolume,
    ]);

    return {
      status: true,
      result: averageValueForVolume,
    };
  } catch (error) {
    log.error(error.message);

    return {
      status: false,
      message: error.message,
    };
  }
};

module.exports = {
  calculateAverageVolume,
};
