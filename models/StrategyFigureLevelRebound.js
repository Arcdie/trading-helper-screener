const mongoose = require('mongoose');

module.exports = {
  modelName: 'StrategyFigureLevelRebound',
};

module.exports.setModuleExport = (modelSchema) => {
  const StrategyFigureLevelRebound = new mongoose.Schema(modelSchema, { versionKey: false });

  module.exports = mongoose.model(
    'StrategyFigureLevelRebound',
    StrategyFigureLevelRebound,
    'strategy-figure-level-rebounds',
  );
};
