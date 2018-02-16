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
  this.longCandle=null;
  this.counter = 0;
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

  // If it was long, set it to short
  if(this.currentTrend === 'long') {
    if( this.shouldSell(this.candles[0],this.candles[1]) ) {
      this.currentTrend = 'short';
      this.advice('short');
    }
  } else {
    if( this.shouldBuy(this.candles[0],this.candles[1]) ) {
      // If it was short, set it to long
      this.longCandle = this.candles[1];
      this.currentTrend = 'long';
      this.advice('long');
    }
  }

}


strat.shouldBuy = function(previous, current) {
  if ( //cs.isBullishKicker(candle1,candle2) ||
       //cs.isShootingStar(candle1,candle2) ||
       //(cs.isHammerAlt(current) && cs.isBullish(previous))||
       //(cs.isBullishEngulfing(candle1,candle2) && ! cs.isInvertedHammerLike(candle1)) ||
       (cs.isBullishStair(previous,current) && !cs.isInvertedHammerLikeAlt(current) && !cs.isInvertedHammerLikeAlt(previous))
      ) {

    this.counter++;
    //console.log("Buying: "+this.counter);
    return true;
  }
}


strat.shouldSell = function(previous, current) {
  if ( (current.close < this.longCandle.close - (this.longCandle.close * .05) && cs.isBearish(current))||
       (cs.isInvertedHammerLikeAlt(current) && ! cs.isHammerLikeAlt(previous) && cs.isBearish(current)) ||
       //cs.isBearishEngulfing(previous,current) ||
       cs.isBearishStair(previous,current)
      ) {

    //console.log("selling: "+this.counter);
    //console.log(previous);
    //console.log(current);
    return true;
  }
}



strat.shouldSellArray = function(candles) {
  if (     candles[1].close < this.longCandle.close - (this.longCandle.close * .03)
        || cs.invertedHammer(candles)
        || cs.bearishEngulfing(candles)

      ) {
    return true;
  }
}

strat.shouldBuyArray = function(candles) {
  if (    // cs.bullishKicker(candles)
        //|| cs.shootingStar(candles)
        //cs.bullishEngulfing(candles)
        cs.hammer(candles)
      ) {
    return true;
  }
}

module.exports = strat;
