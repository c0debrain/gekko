

var log = require('../core/log');
const tu = require('../modules/tradeutil.js');

// Let's create our own strat
var strat = {};

// Prepare everything our method needs
strat.init = function() {
  this.data = [];
  this.input = 'candle';
  this.currentTrend = 'short';
  this.requiredHistory = 0;
  log.info("starting random strategy");
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
    var csvCandle = tu.getCSVCandle(candle)
    console.log(csvCandle)
    this.data.push(csvCandle)
    return
}

strat.end = function() {
    //log.info(this.data);
    var args = {};
    args.data = this.data;
    csv = tu.convertArrayOfObjectsToCSV(args);
    //log.info(csv);
    //tu.writeToFile(csv,"weights/eth-trx-2019-01-01-02-01.csv");
    tu.writeToFile(csv,"weights/eth-trx.csv");
}

module.exports = strat;
