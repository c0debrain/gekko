const neataptic = require('neataptic');
const _ = require('lodash');
const config = require ('../core/util.js').getConfig();
const async = require ('async');
const log = require('../core/log.js');

const cs = require('../modules/candlestick.js');
const tu = require('../modules/tradeutil.js');
const ts = require("timeseries-analysis");

var strat = {};

// Prepare everything our strat needs
strat.init = function() {
    // your code!
    log.info("**** Init ****");
    this.open_order = false;
    this.candleHistory=[];
    //this.requiredHistory = 5;
}


strat.update = function(candle) {
    log.info("*** update ***");
    this.candleHistory.push(candle);
    this.printStat();
}


strat.check = function(candle) {
    log.info("*** check ***");
    log.info("candle history: "+this.candleHistory.length);
}


strat.end = function() {
    log.info("**** End ****");
}


strat.log = function() {
    log.info("** debug **");
    log.info("candle history: "+this.candleHistory.length);
    log.info("candle date: ")
}

strat.printStat = function() {
    log.info("********* stat *********");
    log.info("candle history: "+this.candleHistory.length);
    log.info("last candle date: "+tu.getDate(this.candleHistory.slice(-1)[0]));
}

module.exports = strat;