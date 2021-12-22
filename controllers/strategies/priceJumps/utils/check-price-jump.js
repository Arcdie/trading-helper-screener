const moment = require('moment');

const {
  isUndefined,
} = require('lodash');

const {
  isMongoId,
} = require('validator');

const redis = require('../../../../libs/redis');
const log = require('../../../../libs/logger')(module);

const {
  getUnix,
  getPrecision,
} = require('../../../../libs/support');

const {
  sendData,
} = require('../../../../websocket/websocket-server');

const {
  getInstrumentTrend,
} = require('../../../instrument-trends/utils/get-instrument-trend');

const {
  INTERVALS,
} = require('../../../candles/constants');

const {
  PRICE_JUMPS_CONSTANTS,
} = require('../../../strategies/constants');

const {
  ACTION_NAMES,
} = require('../../../../websocket/constants');

const StrategyPriceJump = require('../../../../models/StrategyPriceJump');

const checkPriceJump = async ({
  instrumentId,
  instrumentName,

  open,
  close,
  startTime,
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

    if (isUndefined(open)) {
      return {
        status: false,
        message: 'No open',
      };
    }

    if (isUndefined(close)) {
      return {
        status: false,
        message: 'No close',
      };
    }

    if (startTime && !moment(startTime).isValid()) {
      return {
        status: false,
        message: 'No or invalid startTime',
      };
    }

    const intervalWithUpperCase = INTERVALS.get('5m').toUpperCase();

    const keyPriceJump = `INSTRUMENT:${instrumentName}:CANDLES_${intervalWithUpperCase}:PRICE_JUMP`;
    const priceJump = await redis.getAsync(keyPriceJump);

    if (priceJump) {
      return { status: true };
    }

    const keyCandlesAverage = `INSTRUMENT:${instrumentName}:CANDLES_${intervalWithUpperCase}:AVERAGE_VALUE`;
    let candlesAverageValue = await redis.getAsync(keyCandlesAverage);

    if (!candlesAverageValue) {
      return { status: true };
    }

    const validOpen = parseFloat(open);
    const validClose = parseFloat(close);
    candlesAverageValue = parseFloat(candlesAverageValue);

    const differenceBetweenPrices = Math.abs(validOpen - validClose);
    const percentPerPrice = 100 / (validOpen / differenceBetweenPrices);

    if (percentPerPrice < (candlesAverageValue * PRICE_JUMPS_CONSTANTS.FACTOR_FOR_PRICE_CHANGE)) {
      return {
        status: true,
      };
    }

    const isLong = validClose > validOpen;

    let isGreenLight = true;

    if (PRICE_JUMPS_CONSTANTS.DOES_CONSIDER_BTC_MICRO_TREND) {
      const resultGetBtcInstrumentTrend = await getInstrumentTrend({ instrumentName: 'BTCUSDTPERP' });

      if (!resultGetBtcInstrumentTrend.status || !resultGetBtcInstrumentTrend.status) {
        const message = resultGetBtcInstrumentTrend.message || 'Cant getInstrumentTrend (BTCUSDTPERP)';
        log.warn(message);

        return {
          status: false,
          message,
        };
      }

      const {
        micro_trend_for_5m_timeframe: btcMicroTrend,
      } = resultGetBtcInstrumentTrend.result;

      if ((btcMicroTrend === 'long' && !isLong)
        || (btcMicroTrend === 'short' && isLong)) {
        isGreenLight = false;
      }
    }

    if (PRICE_JUMPS_CONSTANTS.DOES_CONSIDER_FUTURES_MICRO_TREND) {
      const resultGetInstrumentTrend = await getInstrumentTrend({ instrumentName });

      if (!resultGetInstrumentTrend.status || !resultGetInstrumentTrend.status) {
        const message = resultGetInstrumentTrend.message || `Cant getInstrumentTrend (${instrumentName})`;
        log.warn(message);

        return {
          status: false,
          message,
        };
      }

      const {
        micro_trend_for_5m_timeframe: instrumentMicroTrend,
      } = resultGetInstrumentTrend.result;

      if ((instrumentMicroTrend === 'long' && !isLong)
        || (instrumentMicroTrend === 'short' && isLong)) {
        isGreenLight = false;
      }
    }

    if (!isGreenLight) {
      return {
        status: true,
      };
    }

    let price = isLong ? open + differenceBetweenPrices : open - differenceBetweenPrices;
    const precisionOfOpen = getPrecision(open);
    price = parseFloat(price.toFixed(precisionOfOpen));

    const newStrategyPriceJump = new StrategyPriceJump({
      instrument_id: instrumentId,
      is_long: isLong,

      price,
      candles_average_volume: candlesAverageValue,
      factor: PRICE_JUMPS_CONSTANTS.FACTOR_FOR_PRICE_CHANGE,

      candle_time: startTime,
    });

    await newStrategyPriceJump.save();

    const coeff = 5 * 60 * 1000;
    const nowUnix = getUnix();
    const startTimeUnix = getUnix();
    const nextIntervalUnix = (Math.ceil((nowUnix * 1000) / coeff) * coeff) / 1000;

    let expireAfter = Math.abs(nextIntervalUnix - nowUnix);

    if (expireAfter < 30) {
      expireAfter += (300 + expireAfter);
    }

    await redis.setAsync([
      keyPriceJump,
      startTimeUnix,
      'EX',
      expireAfter,
    ]);

    sendData({
      actionName: ACTION_NAMES.get('newPriceJump'),
      data: {
        isLong,
        instrumentId,
        instrumentName,
        instrumentPrice: price,
        strategyTargetId: newStrategyPriceJump._id,
      },
    });

    return {
      status: true,
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
  checkPriceJump,
};
