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
  sendMessage,
} = require('../../../telegram/utils/send-message');

const {
  ACTION_NAMES,
} = require('../../../../websocket/constants');

const StrategyFigureLevelRebound = require('../../../../models/StrategyFigureLevelRebound');

const PERCENT_FOR_DEFINE_REBOUND = 3; // %

const checkFigureLevelRebound = async ({
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

    const keyChecker = `INSTRUMENT:${instrumentName}:FIGURE_LEVEL_BOUNDS_CHECKER`;
    const checkerResult = await redis.getAsync(keyChecker);

    if (checkerResult) {
      return { status: true };
    }

    const keyInstrumentLevelBounds = `INSTRUMENT:${instrumentName}:FIGURE_LEVEL_BOUNDS`;
    const cacheInstrumentLevelBoundsKeys = await redis.hkeysAsync(keyInstrumentLevelBounds);

    if (!cacheInstrumentLevelBoundsKeys || !cacheInstrumentLevelBoundsKeys.length) {
      return { status: true };
    }

    const validClose = parseFloat(close);

    const targetKeys = [];

    cacheInstrumentLevelBoundsKeys.forEach(key => {
      let [price, prefix] = key.split('_');
      const isLong = prefix === 'long';
      price = parseFloat(price);

      // tmp
      if (!isLong) {
        return true;
      }

      const percentPerPrice = price * (PERCENT_FOR_DEFINE_REBOUND / 100);

      const triggerPrice = isLong ?
        price - percentPerPrice : price + percentPerPrice;

      if (isLong && validClose > triggerPrice) {
        targetKeys.push(key);
      } else if (!isLong && validClose < triggerPrice) {
        targetKeys.push(key);
      }
    });

    if (!targetKeys.length) {
      return { status: true };
    }

    const cacheInstrumentLevelBounds = await redis.hmgetAsync(
      keyInstrumentLevelBounds, targetKeys,
    );

    if (!cacheInstrumentLevelBounds || !cacheInstrumentLevelBounds.length) {
      return { status: true };
    }

    const boundsIds = [];

    cacheInstrumentLevelBounds.forEach(bounds => {
      bounds = JSON.parse(bounds);

      bounds.forEach(bound => {
        boundsIds.push(bound.bound_id);
      });
    });

    await Promise.all(boundsIds.map(async boundId => {
      const doesExistActiveStrategy = await StrategyFigureLevelRebound.exists({
        instrument_id: instrumentId,
        figure_level_bound_id: boundId,

        is_active: true,
      });

      if (doesExistActiveStrategy) {
        return null;
      }

      const newStrategy = new StrategyFigureLevelRebound({
        instrument_id: instrumentId,
        figure_level_bound_id: boundId,
      });

      await newStrategy.save();

      sendData({
        actionName: ACTION_NAMES.get('figureLevelRebound'),
        data: {
          instrumentId,
          instrumentName,
          instrumentPrice: validClose,

          strategyTargetId: newStrategy._id,
          strategyName: ACTION_NAMES.get('figureLevelRebound'),
        },
      });

      /*
      const message = `FigureLevelRebound:${instrumentName}
  https://ru.tradingview.com/chart/?symbol=${instrumentName}&interval=60
  https://trading-helper.ru/monitoring?symbol=${instrumentName}&interval=1h`;

      sendMessage(260325716, message);
      // */
    }));

    const nowUnix = getUnix();
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
  checkFigureLevelRebound,
};
