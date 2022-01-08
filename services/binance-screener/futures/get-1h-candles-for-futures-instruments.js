const WebSocketClient = require('ws');

const log = require('../../../libs/logger')(module);

const {
  sendMessage,
} = require('../../../controllers/telegram/utils/send-message');

const {
  checkPriceJump,
} = require('../../../controllers/strategies/priceJumps/utils/check-price-jump');

const {
  checkPriceRebound,
} = require('../../../controllers/strategies/priceRebounds/utils/check-price-rebound');

const {
  calculateAveragePercentForCandles,
} = require('../../../controllers/candles/utils/calculate-average-percent-for-candles');

const {
  binanceScreenerConf,
} = require('../../../config');

const {
  ACTION_NAMES,
} = require('../../../websocket/constants');

const {
  INTERVALS,
} = require('../../../controllers/candles/constants');

const CONNECTION_NAME = 'TradinScreenerToBinanceScreener:Futures:Kline_1h';

class InstrumentQueue {
  constructor(instrumentName) {
    this.lastTick = false;
    this.isActive = false;
    this.instrumentName = instrumentName;
  }

  updateLastTick(obj) {
    this.lastTick = obj;

    if (!this.isActive) {
      this.isActive = true;
      this.nextStep();
    }
  }

  async nextStep() {
    const [
      resultCheckPriceJump,
    ] = await Promise.all([
      checkPriceJump({
        ...this.lastTick,
        timeframe: INTERVALS.get('1h'),
      }),
    ]);

    if (!resultCheckPriceJump || !resultCheckPriceJump.status) {
      log.warn(resultCheckPriceJump.message || 'Cant checkPriceJump');
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
          data: { subscriptionName: ACTION_NAMES.get('futuresCandle1hData') },
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
          instrumentId,
          instrumentName,
        } = parsedData.data;

        if (!instrumentsQueues[instrumentName]) {
          instrumentsQueues[instrumentName] = new InstrumentQueue(instrumentName);
        }

        instrumentsQueues[instrumentName].updateLastTick(parsedData.data);

        if (parsedData.data.isClosed) {
          const resultCalculate = await calculateAveragePercentForCandles({
            instrumentId,
            instrumentName,

            timeframe: INTERVALS.get('1h'),
          });

          if (!resultCalculate || !resultCalculate.status) {
            log.warn(resultCalculate.message || 'Cant calculateAveragePercentForCandles');
          }
        }
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
