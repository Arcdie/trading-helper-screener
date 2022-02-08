// candle figure (молот)

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
} = require('../../../../libs/support');

const {
  sendMessage,
} = require('../../../telegram/utils/send-message');

const {
  sendData,
} = require('../../../../websocket/websocket-server');

const {
  INTERVALS,
} = require('../../../candles/constants');

const {
  PRICE_ROLLBACKS_CONSTANTS,
} = require('../../../strategies/constants');

const {
  ACTION_NAMES,
} = require('../../../../websocket/constants');

const checkPriceRollback = async ({
  instrumentId,
  instrumentName,

  open,
  close,

  low,
  high,

  volume,
  timeframe,
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

    if (isUndefined(low)) {
      return {
        status: false,
        message: 'No low',
      };
    }

    if (isUndefined(high)) {
      return {
        status: false,
        message: 'No high',
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

    const keyPriceRollback = `INSTRUMENT:${instrumentName}:CANDLES_${intervalWithUpperCase}:PRICE_ROLLBACK`;
    const priceRollback = await redis.getAsync(keyPriceRollback);

    if (priceRollback) {
      return { status: true };
    }

    const keyVolumeAverage = `INSTRUMENT:${instrumentName}:CANDLES_${intervalWithUpperCase}:AVERAGE_VOLUME_VALUE`;
    let volumeAverageValue = await redis.getAsync(keyVolumeAverage);

    if (!volumeAverageValue) {
      return { status: true };
    }

    volumeAverageValue = parseFloat(volumeAverageValue);

    if (volume < (volumeAverageValue * PRICE_ROLLBACKS_CONSTANTS.FACTOR_FOR_VOLUME_CHANGE)) {
      return { status: true };
    }

    const validOpen = parseFloat(open);
    const validClose = parseFloat(close);
    const validHigh = parseFloat(high);
    const validLow = parseFloat(low);

    let isGreenLight = false;

    const isLong = validClose > validOpen;
    const fullPriceRange = validHigh - validHigh;

    const differenceBetweenOpenAndClose = Math.abs(validOpen - validClose);
    let percentPerPrice = 100 / (fullPriceRange / differenceBetweenOpenAndClose);

    if (percentPerPrice < 30) {
      if (isLong) {
        const differenceBetweenHighAndClose = validHigh - validClose;
        percentPerPrice = 100 / (fullPriceRange / differenceBetweenHighAndClose);

        if (percentPerPrice > 55) {
          isGreenLight = true;
        }
      } else {
        const differenceBetweenCloseAndLow = validClose - validLow;
        percentPerPrice = 100 / (fullPriceRange / differenceBetweenCloseAndLow);

        if (percentPerPrice > 55) {
          isGreenLight = true;
        }
      }
    }

    if (!isGreenLight) {
      return {
        status: true,
      };
    }

    const nowUnix = getUnix();
    const expireAfter = timeframe === INTERVALS.get('5m') ?
      30 * 60 : 3 * 60 * 60; // 30 minutes - 3 hours

    await redis.setAsync([
      keyPriceRollback,
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

    const message = `PriceRollback:${intervalWithUpperCase}
https://ru.tradingview.com/chart/?symbol=${instrumentName}&interval=${interval}
https://trading-helper.ru/monitoring?symbol=${instrumentName}&interval=${timeframe}`;

    sendMessage(260325716, message);
    // sendMessage(1784451390, message);

    sendData({
      actionName: ACTION_NAMES.get('newPriceRollback'),
      data: {
        isLong,
        instrumentId,
        instrumentName,
        instrumentPrice: validClose,
        // strategyTargetId: newStrategyPriceRebound._id,
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
  checkPriceRollback,
};
