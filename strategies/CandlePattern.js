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
    this.limit = 2;
}

// What happens on every new candle?
strat.update = function(candle) {
    // Get a random number between 0 and 1.
    this.randomNumber = Math.random();

    // There is a 10% chance it is smaller than 0.1
    this.toUpdate = this.randomNumber < 0.5;

}

// For debugging purposes.
strat.log = function() {
    //log.debug('calculated random number:');
    //log.debug('\t', this.randomNumber.toFixed(3));
}

// Based on the newly calculated
// information, check if we should
// update or not.
strat.check = function(candle) {

    this.candles.push(candle);
    if(this.candles.length < this.limit) {
        return;
    } else if (this.candles.length > this.limit) {
        this.candles.shift();
    }

    log.info("Candle length: "+this.candles.length);

    // If it was long, set it to short
    if(this.currentTrend === 'long') {
        if( this.shouldSell(this.candles) ) {
            this.currentTrend = 'short';
            this.advice('short');
        }
    } else {
        if( this.shouldBuy(this.candles) ) {
            // If it was short, set it to long
            this.longCandle = this.candle;
            this.currentTrend = 'long';
            this.advice('long');
        }
    }

}


strat.shouldBuy = function(candles) {
    for(var i=0;i<candles.length;i++) {
        if (!cs.isBullish(candles[i])) {
            return false;
        }
    }
    return candles[candles.length-1].close > candles[0].close;
}


strat.shouldSell = function(candles) {
    if(candles[candles.length-1].close < this.longCandle.close) {
        return true;
    }

    if(cs.isBearish(candles[candles.length-1])) {
        return true;
    }

    for(var i=0;i<candles.length;i++) {
        if (!cs.isBearish(candles[i])) {
            return false;
        }
    }
    return false;
}


module.exports = strat;
