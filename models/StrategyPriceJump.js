const mongoose = require('mongoose');

module.exports = {
  modelName: 'StrategyPriceJump',
};

module.exports.setModuleExport = (modelSchema) => {
  const StrategyPriceJump = new mongoose.Schema(modelSchema, { versionKey: false });
  module.exports = mongoose.model('StrategyPriceJump', StrategyPriceJump, 'strategy-price-jumps');
};
