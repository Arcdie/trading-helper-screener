const WebSocketClient = require('ws');

const log = require('../../../libs/logger')(module);

const QueueHandler = require('../../../libs/queue-handler');

const {
  sendMessage,
} = require('../../../controllers/telegram/utils/send-message');

const {
  checkPriceJump,
} = require('../../../controllers/strategies/priceJumps/utils/check-price-jump');

const {
  checkFigureLineRebound,
} = require('../../../controllers/strategies/figureLineRebounds/utils/check-figure-line-rebounds');

const {
  checkFigureLevelRebound,
} = require('../../../controllers/strategies/figureLevelRebounds/utils/check-figure-level-rebounds');

const {
  binanceScreenerConf,
} = require('../../../config');

const {
  ACTION_NAMES,
} = require('../../../websocket/constants');

const {
  INTERVALS,
} = require('../../../controllers/candles/constants');

const CONNECTION_NAME = 'TradinScreenerToBinanceScreener:Futures:Kline_5m';

class InstrumentQueueWithDelay extends QueueHandler {
  async nextTick() {
    const [
      // resultCheckPriceJump,
      resultCheckFigureLineRebound,
      resultCheckFigureLevelRebound,
    ] = await Promise.all([

      /*
      checkPriceJump({
        ...this.lastTick,
        timeframe: INTERVALS.get('5m'),
      }),
      */

      checkFigureLineRebound(this.lastTick),
      checkFigureLevelRebound(this.lastTick),
    ]);

    /*
    if (!resultCheckPriceJump || !resultCheckPriceJump.status) {
      log.warn(resultCheckPriceJump.message || 'Cant checkPriceJump');
    }
    */

    if (!resultCheckFigureLineRebound) {
      log.warn(resultCheckFigureLineRebound.message || 'Cant checkFigureLineRebound');
    }

    if (!resultCheckFigureLevelRebound) {
      log.warn(resultCheckFigureLevelRebound.message || 'Cant checkFigureLevelRebound');
    }

    setTimeout(() => { this.nextStep(); }, 1 * 1000);
  }
}

module.exports = async () => {
  try {
    let sendPongInterval;
    const instrumentsQueues = [];
    const connectStr = `ws://${binanceScreenerConf.host}:${binanceScreenerConf.websocketPort}`;

    const websocketConnect = () => {
      let isOpened = false;
      let client = new WebSocketClient(connectStr);

      client.on('open', () => {
        isOpened = true;
        log.info(`${CONNECTION_NAME} was opened`);

        client.send(JSON.stringify({
          actionName: 'subscribe',
          data: { subscriptionName: ACTION_NAMES.get('futuresCandle5mData') },
        }));

        sendPongInterval = setInterval(() => {
          client.send(JSON.stringify({ actionName: 'pong' }));
        }, 10 * 60 * 1000); // 10 minutes
      });

      client.on('close', (message) => {
        log.info(`${CONNECTION_NAME} was closed`);

        client = false;
        clearInterval(sendPongInterval);
        sendMessage(260325716, `${CONNECTION_NAME} was closed (${message})`);
        websocketConnect();
      });

      client.on('message', async bufferData => {
        const parsedData = JSON.parse(bufferData.toString());

        const {
          isClosed,
          instrumentId,
          instrumentName,
        } = parsedData.data;

        if (!instrumentsQueues[instrumentName]) {
          instrumentsQueues[instrumentName] = new InstrumentQueueWithDelay(instrumentName);
        }

        instrumentsQueues[instrumentName].updateLastTick(parsedData.data);
      });

      setTimeout(() => {
        if (!isOpened) {
          client = false;
          clearInterval(sendPongInterval);
          sendMessage(260325716, `Cant connect to ${CONNECTION_NAME}`);
          websocketConnect();
        }
      }, 10 * 1000); // 10 seconds
    };

    websocketConnect();
  } catch (error) {
    log.error(error.message);
    console.log(error);
    return false;
  }
};
