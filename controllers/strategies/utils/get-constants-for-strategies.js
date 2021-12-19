const axios = require('axios');

const log = require('../../../libs/logger')(module);

const {
  tradingHelperConf,
} = require('../../../config');

const getConstantsForStrategies = async () => {
  try {
    const request = await axios({
      method: 'GET',
      url: `https://${tradingHelperConf.url}/api/strategies/constants`,

      headers: {
        'Content-Type': 'application/json',
      },
    });

    return {
      status: true,
      result: request.data,
    };
  } catch (error) {
    log.warn(error.message);

    return {
      status: false,
      message: error.response.data,
    };
  }
};

module.exports = {
  getConstantsForStrategies,
};
