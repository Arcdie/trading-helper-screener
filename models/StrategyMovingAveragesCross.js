const mongoose = require('mongoose');

module.exports = {
  modelName: 'StrategyMovingAveragesCross',
};

module.exports.setModuleExport = (modelSchema) => {
  const StrategyMovingAveragesCross = new mongoose.Schema(modelSchema, { versionKey: false });

  module.exports = mongoose.model(
    'StrategyMovingAveragesCross',
    StrategyMovingAveragesCross,
    'strategy-moving-averages-crossed',
  );
};
