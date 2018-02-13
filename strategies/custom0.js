// This is a basic example strategy for Gekko.
// For more information on everything please refer
// to this document:
//
// https://gekko.wizb.it/docs/strategies/creating_a_strategy.html
//
// The example below is pretty bad investment advice: on every new candle there is
// a 10% chance it will recommend to change your position (to either
// long or short).

var log = require('../core/log');
const cs = require('candlestick');

// Let's create our own strat
var strat = {};

// Prepare everything our method needs
strat.init = function() {
  this.input = 'candle';
  this.currentTrend = 'short';
  this.requiredHistory = 0;
  this.candles=[];
}

// What happens on every new candle?
strat.update = function(candle) {
  // Get a random number between 0 and 1.
  this.randomNumber = Math.random();

  // There is a 10% chance it is smaller than 0.1
  this.toUpdate = this.randomNumber < 0.5;

  this.candles[0] = this.candles[1];
  this.candles[1] = candle;

}

// For debugging purposes.
strat.log = function() {
  //log.debug('calculated random number:');
  //log.debug('\t', this.randomNumber.toFixed(3));
}

// Based on the newly calculated
// information, check if we should
// update or not.
strat.check = function() {

  // Only continue if we have a new update.
  //if(!this.toUpdate)
    //return;

  if(this.candles[0]==null || this.candles[1] == null ) {
    return;
  }

  //console.log(this.candles[0]);
  //console.log(this.candles[1]);

  // If it was long, set it to short
  if(this.currentTrend === 'long') {
    if(cs.isBearishKicker(this.candles[0], this.candles[1])
        ) {
      this.currentTrend = 'short';
      this.advice('short');
    }
  } else {
    if(cs.isBullishKicker(this.candles[0],this.candles[1]) ||
        cs.isShootingStar(this.candles[0], this.candles[1])) {
      // If it was short, set it to long
      this.currentTrend = 'long';
      this.advice('long');
    }
  }
}

module.exports = strat;
