const mongoose = require('mongoose');

module.exports = {
  modelName: 'StrategyFigureLineRebound',
};

module.exports.setModuleExport = (modelSchema) => {
  const StrategyFigureLineRebound = new mongoose.Schema(modelSchema, { versionKey: false });

  module.exports = mongoose.model(
    'StrategyFigureLineRebound',
    StrategyFigureLineRebound,
    'strategy-figure-line-rebounds',
  );
};
