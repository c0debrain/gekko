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
    config.debug = false;
    this.open_order = false;
    this.candleHistory=[];
    this.requiredHistory = config.tradingAdvisor.historySize;
    this.lookbackIndex=1;

    this.perceptron = new neataptic.architect.Perceptron(4,3,1);
    this.perceptronOptions = {
        //dropout: 0.5,
        //clear: true,
        log: 90000,
        shuffle:true,
        iterations: 100000,
        error: 0.000000000001,
        rate: 0.0003,
    };
}


strat.update = function(candle) {
    log.info("*** update ***");
    this.candleHistory.push(candle);
    log.info("candle date: "+tu.getDate(candle));

    if(this.candleHistory.length > this.lookbackIndex) {

    }
}


strat.check = function(candle) {
    log.info("*** check ***");
    log.info("candle history: "+this.candleHistory.length);
    log.info("candle date: "+tu.getDate(candle));
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