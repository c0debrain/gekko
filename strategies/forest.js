
var log = require('../core/log');
const tu = require('../modules/tradeutil.js');

const xgboost = require('xgboost');
//const model = xgboost.XGModel('iris.xg.model');
const model = xgboost.XGModel('weights/eth-trx.model.bin');
if (model.error) {
    console.log(model.error);
} else {
    log.info("loaded model.")
}

// Let's create our own strat
var strat = {};

// Prepare everything our method needs
strat.init = function() {
  this.counter = 0;
  this.data = [];
  this.dataBack = [];
  this.input = 'candle';
  this.currentTrend = 'short';
  this.requiredHistory = 0;
  this.openOrder = false;
  log.info("** starting random forest strategy **")
}

// What happens on every new candle?
strat.update = function(candle) {

  // Get a random number between 0 and 1.
  this.randomNumber = Math.random();

  // There is a 10% chance it is smaller than 0.1
  this.toUpdate = this.randomNumber < 0.1;
}

// For debugging purposes.
strat.log = function() {
  //log.debug('calculated random number:');
  //log.debug('\t', this.randomNumber.toFixed(3));
}

strat.check = function(candle) {
  const lcandle = tu.getLabeldCandle(candle)

  const input = tu.getLabeldCandleFloat32Array(candle)
  const mat = new xgboost.matrix(input, 1, 9)
  const result = model.predict(mat)
  console.log(result)
  const val = result.value[0]

  if(this.openOrder && val < .3) {
    this.openOrder = false;
    this.advice('short');
  
  } else if(val >= .4) {
    this.openOrder = true;
    this.advice('long');
  }
}

strat.end = function() {
  log.info("end strategy")
}

module.exports = strat;
