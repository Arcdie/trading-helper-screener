const mongoose = require('mongoose');

module.exports = {
  modelName: 'StrategyPriceRebound',
};

module.exports.setModuleExport = (modelSchema) => {
  const StrategyPriceRebound = new mongoose.Schema(modelSchema, { versionKey: false });
  module.exports = mongoose.model('StrategyPriceRebound', StrategyPriceRebound, 'strategy-price-rebounds');
};
