const ACTION_NAMES = new Map([
  // data
  ['spotCandle1mData', 'spotCandle1mData'],
  ['spotCandle5mData', 'spotCandle5mData'],

  ['futuresCandle1mData', 'futuresCandle1mData'],
  ['futuresCandle5mData', 'futuresCandle5mData'],

  // strategies
  ['newPriceJump', 'newPriceJump'],
  ['newPriceRebound', 'newPriceRebound'],
  ['newPriceRollback', 'newPriceRollback'],

  ['figureLineRebound', 'figureLineRebound'],
  ['figureLevelRebound', 'figureLevelRebound'],
]);

module.exports = {
  ACTION_NAMES,
};
