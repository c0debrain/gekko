
var log = require('../core/log');
const tu = require('../modules/tradeutil.js');

const xgboost = require('xgboost');
//const model = xgboost.XGModel('iris.xg.model');

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
  
  this.weightFile = "weights/"+this.settings.weight_file;
  this.inputLength = 5
  this.sellPoint = this.settings.sell_point;
  this.buyPoint = this.settings.buy_point;

  this.buyPrice = 0;
  this.result = 0;

  this.model = xgboost.XGModel(this.weightFile);
  if (this.model.error) {
      console.log(model.error);
  } else {
      log.info("loaded model.")
  }
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
  const mat = new xgboost.matrix(input, 1, this.inputLength)
  const result = this.model.predict(mat)
  this.result = result.value[0]
  console.log()
  console.log(++this.counter+" Advice: "+this.result)
  console.log(tu.getDate(candle))

  if(this.shouldBuy()) {
    this.buy(candle)
  } else if(this.shouldSell()) {
    this.sell(candle)
  }
}

strat.shouldSell = function() {
  return this.openOrder && 
    this.result < this.sellPoint
}

strat.shouldBuy = function() {
  return !this.openOrder && 
    this.result >= this.buyPoint
}

strat.buy = function(candle) {
  this.openOrder = true;
  this.buyPrice = candle.close;
  this.advice('long');
  console.log("*** buy $$$: "+candle.close)
  console.log("Buy price: "+this.buyPrice)
}

strat.sell = function (candle) {
  this.openOrder = false
  this.advice('short')
  console.log("*** sell: "+candle.close)
  console.log("Buy price: "+this.buyPrice)
}

strat.end = function() {
  log.info("end strategy")
}

module.exports = strat;
