const log = require('../../../libs/logger')(module);

const {
  PERIODS,
  NUMBER_CANDLES_FOR_SHORT_PERIOD,
  NUMBER_CANDLES_FOR_MEDIUM_PERIOD,
} = require('../constants');

const calculateMovingAverage = (inputData, period) => {
  try {
    if (!inputData || !inputData.length) {
      log.warn('No candles');
      return false;
    }

    if (!period || !PERIODS.get(period)) {
      log.warn('No or invalid period');
      return false;
    }

    let numberCandles = 0;

    switch (period) {
      case PERIODS.get('short'): numberCandles = NUMBER_CANDLES_FOR_SHORT_PERIOD; break;
      case PERIODS.get('medium'): numberCandles = NUMBER_CANDLES_FOR_MEDIUM_PERIOD; break;
      default: break;
    }

    if (!numberCandles) {
      return [];
    }

    const resultData = [];
    const workingData = [];

    inputData.forEach((d, index) => {
      workingData.push(d.value);

      const currentData = workingData.slice(index - (numberCandles - 1));
      const sum = currentData.reduce((i, close) => i + close, 0);
      const average = sum / currentData.length;

      resultData.push({
        value: average,
        time: d.time,
      });
    });

    return resultData;
  } catch (error) {
    log.warn(error.message);
    return false;
  }
};

module.exports = {
  calculateMovingAverage,
};
