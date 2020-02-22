
var log = require('../core/log');
const tu = require('../modules/tradeutil.js');

// Let's create our own strat
var strat = {};

// Prepare everything our method needs
strat.init = function() {
  this.counter = 0
  this.history=[]
  this.input = 'candle';
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
  if(this.openOrder) {
    this.openOrder = false;
    this.advice('short');
  } else {
    this.openOrder = true;
    this.advice('long');
  }
}

strat.end = function() {
  log.info("end strategy")
}

module.exports = strat;
