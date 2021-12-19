const log = require('../../libs/logger')(module);

const {
  setModuleExport,
} = require('../../controllers/strategies/constants');

const {
  getConstantsForStrategies,
} = require('../../controllers/strategies/utils/get-constants-for-strategies');

module.exports = (async () => {
  try {
    const resultRequestGetConstants = await getConstantsForStrategies();

    if (!resultRequestGetConstants || !resultRequestGetConstants.status) {
      const message = resultRequestGetConstants.message || 'Cant getConstantsForStrategies';

      log.warn(message);
      throw new Error(message);
    }

    const constants = resultRequestGetConstants.result;

    if (!constants || !constants.status || !constants.result) {
      const message = constants.message || 'No constants';

      log.warn(message);
      throw new Error(message);
    }

    setModuleExport(constants.result);
  } catch (error) {
    log.error(error.message);
    process.exit(1);
  }
});
