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
  sendMessage,
} = require('../../../telegram/utils/send-message');

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

  timeframe,

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

    if (!timeframe || !INTERVALS.get(timeframe)) {
      return {
        status: false,
        message: 'No or invalid timeframe',
      };
    }

    const intervalWithUpperCase = INTERVALS.get(timeframe).toUpperCase();

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

    let price = isLong ? open + differenceBetweenPrices : open - differenceBetweenPrices;
    const precisionOfOpen = getPrecision(open);
    price = parseFloat(price.toFixed(precisionOfOpen));

    /*
    const newStrategyPriceJump = new StrategyPriceJump({
      instrument_id: instrumentId,
      is_long: isLong,

      price,
      candles_average_volume: candlesAverageValue,
      factor: PRICE_JUMPS_CONSTANTS.FACTOR_FOR_PRICE_CHANGE,

      candle_time: startTime,
    });

    await newStrategyPriceJump.save();
    */

    const nowUnix = getUnix();
    const expireAfter = timeframe === INTERVALS.get('5m') ?
      30 * 60 : 3 * 60 * 60; // 30 minutes - 3 hours

    await redis.setAsync([
      keyPriceJump,
      nowUnix,
      'EX',
      expireAfter,
    ]);

    let interval = 1;

    switch (timeframe) {
      case INTERVALS.get('5m'): interval = 5; break;
      case INTERVALS.get('1h'): interval = 60; break;

      default: break;
    }

    const message = `PriceJump:${intervalWithUpperCase}
https://ru.tradingview.com/chart/?symbol=${instrumentName}&interval=${interval}
https://trading-helper.ru/monitoring?symbol=${instrumentName}&interval=${timeframe}`;

    sendMessage(260325716, message);
    sendMessage(1784451390, message);

    sendData({
      actionName: ACTION_NAMES.get('newPriceJump'),
      data: {
        isLong,
        instrumentId,
        instrumentName,
        instrumentPrice: validClose,
        // strategyTargetId: newStrategyPriceJump._id,
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
