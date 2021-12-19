const {
  isUndefined,
} = require('lodash');

const {
  isMongoId,
} = require('validator');

const redis = require('../../../../libs/redis');
const log = require('../../../../libs/logger')(module);

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

const checkPriceJump = async ({
  instrumentId,
  instrumentName,

  open,
  close,
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

    const intervalWithUpperCase = INTERVALS.get('5m').toUpperCase();

    const keyCandlesAverage = `INSTRUMENT:${instrumentName}:CANDLES_${intervalWithUpperCase}_AVERAGE_VALUE`;
    let candlesAverageValue = await redis.getAsync(keyCandlesAverage);

    if (isUndefined(candlesAverageValue)) {
      const message = `No candlesAverageValue for ${instrumentName}`;

      log.warn(message);
      return {
        status: false,
        message,
      };
    }

    const validOpen = parseFloat(open);
    const validClose = parseFloat(close);
    candlesAverageValue = parseFloat(candlesAverageValue);

    const differenceBetweenPrices = Math.abs(validOpen - validClose);
    const percentPerPrice = 100 / (validOpen / differenceBetweenPrices);

    if (percentPerPrice > (candlesAverageValue * PRICE_JUMPS_CONSTANTS.FACTOR_FOR_PRICE_CHANGE)) {
      console.log(instrumentName, percentPerPrice.toFixed(2), candlesAverageValue);
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

      sendData({
        actionName: ACTION_NAMES.get('newPriceJump'),
        data: {
          instrumentId,
          instrumentName,
        },
      });
    }

    return {
      status: true,
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
  checkPriceJump,
};
