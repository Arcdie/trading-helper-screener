const axios = require('axios');

const log = require('../../../libs/logger')(module);

const {
  tradingHelperConf,
} = require('../../../config');

const getModelByName = async ({
  modelName,
}) => {
  try {
    const params = {
      modelName,
    };

    const request = await axios({
      method: 'GET',
      url: `https://${tradingHelperConf.url}/api/models/${modelName}`,

      headers: {
        'Content-Type': 'application/json',
      },

      params,
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
  getModelByName,
};
