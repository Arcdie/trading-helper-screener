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
  sendData,
} = require('../../../../websocket/websocket-server');

const {
  INTERVALS,
} = require('../../../candles/constants');

const {
  ACTION_NAMES,
} = require('../../../../websocket/constants');

const StrategyFigureLineRebound = require('../../../../models/StrategyFigureLineRebound');

const PERCENT_FOR_DEFINE_REBOUND = 3; // %

const checkMovingAveragesCrossed = async ({
  instrumentId,
  instrumentName,

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

    if (isUndefined(close)) {
      return {
        status: false,
        message: 'No close',
      };
    }

    const keyChecker = `INSTRUMENT:${instrumentName}:FIGURE_LINE_BOUNDS_CHECKER`;
    const checkerResult = await redis.getAsync(keyChecker);

    if (checkerResult) {
      return { status: true };
    }

    const keyInstrumentLineBounds = `INSTRUMENT:${instrumentName}:FIGURE_LINE_BOUNDS`;
    let cacheInstrumentLineBounds = await redis.getAsync(keyInstrumentLineBounds);

    if (!cacheInstrumentLineBounds) {
      cacheInstrumentLineBounds = [];
    } else {
      cacheInstrumentLineBounds = JSON.parse(cacheInstrumentLineBounds);
    }

    if (!cacheInstrumentLineBounds.length) {
      return { status: true };
    }

    const boundsIds = [];
    const nowUnix = getUnix();
    const validClose = parseFloat(close);

    cacheInstrumentLineBounds.forEach(bound => {
      if (!bound.is_moderated) {
        return true;
      }

      if (bound.timeframe === INTERVALS.get('5m')) {
        return true;
      }

      const divider = bound.timeframe === INTERVALS.get('5m') ? 300 : 3600;
      const startOfIntervalUnix = nowUnix - (nowUnix % divider);

      const numberCandlesBetweenDates = (startOfIntervalUnix - bound.candle_time) / divider;

      if (bound.is_long) {
        const linePrice = bound.candle_extremum + (bound.price_angle * numberCandlesBetweenDates);
        const percentPerPrice = linePrice * (PERCENT_FOR_DEFINE_REBOUND / 100);
        const triggerPrice = linePrice + percentPerPrice;

        if (validClose < triggerPrice) {
          boundsIds.push(bound.bound_id);
        }
      } else {
        const linePrice = bound.candle_extremum - (bound.price_angle * numberCandlesBetweenDates);
        const percentPerPrice = linePrice * (PERCENT_FOR_DEFINE_REBOUND / 100);
        const triggerPrice = linePrice - percentPerPrice;

        if (validClose > triggerPrice) {
          boundsIds.push(bound.bound_id);
        }
      }
    });

    await Promise.all(boundsIds.map(async boundId => {
      const doesExistActiveStrategy = await StrategyFigureLineRebound.exists({
        instrument_id: instrumentId,
        figure_line_bound_id: boundId,

        is_active: true,
      });

      if (doesExistActiveStrategy) {
        return null;
      }

      const newStrategy = new StrategyFigureLineRebound({
        instrument_id: instrumentId,
        figure_line_bound_id: boundId,
      });

      await newStrategy.save();

      sendData({
        actionName: ACTION_NAMES.get('figureLineRebound'),
        data: {
          instrumentId,
          instrumentName,
          instrumentPrice: validClose,

          strategyTargetId: newStrategy._id,
          strategyName: ACTION_NAMES.get('figureLineRebound'),
        },
      });

      /*
      const message = `FigureLevelRebound:${instrumentName}
  https://ru.tradingview.com/chart/?symbol=${instrumentName}&interval=60
  https://trading-helper.fun/monitoring?symbol=${instrumentName}&interval=1h`;

      sendMessage(260325716, message);
      // */
    }));

    const expireAfter = 1 * 60 * 60; // 1 hour

    await redis.setAsync([
      keyChecker,
      nowUnix,
      'EX',
      expireAfter,
    ]);

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
  checkMovingAveragesCrossed,
};
