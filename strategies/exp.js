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
    this.trainingData=[];
    this.requiredHistory = config.tradingAdvisor.historySize;
    this.lookbackIndex=1;

    this.perceptron = new neataptic.architect.Perceptron(4,3,1);
    this.perceptronOptions =  {
        //dropout: 0.5,
        clear: true,
        log: 800000,
        //shuffle:true,
        iterations: 900000,
        error: 0.000000000001,
        rate: 0.003,
    };
}


strat.update = function(candle) {
    log.info("*** update ***");
    this.candleHistory.push(candle);
    log.info("candle date: "+tu.getDate(candle));
    log.info("candle data: "+[candle.open,candle.close]);


    if(this.candleHistory.length > this.lookbackIndex) {
        var myObj = {};
        var inputCandle = this.candleHistory.slice(-2)[0];
        myObj['input'] = [inputCandle.open,inputCandle.close,inputCandle.high,inputCandle.low];
        myObj['output'] = [candle.close];
        this.trainingData.push(myObj);
    }

    if(this.trainingData.length > this.requiredHistory) {
        this.trainingData.shift();
    }

    if(this.trainingData.length >= this.requiredHistory) {
        console.log("about to train");
        console.log(this.trainingData);
        this.perceptron.train(this.trainingData,this.perceptronOptions);
    }
}


strat.check = function(candle) {

    log.info("*** check ***");
    log.info("candle history: "+this.candleHistory.length);
    log.info("candle date: "+tu.getDate(candle));

    var predictValue = this.perceptron.activate([candle.open,candle.close,candle.high,candle.low]);
    var predictPercent = tu.getPercent(candle.close,predictValue);

    log.info("predict: "+predictValue+" %: "+predictPercent);

    if(predictPercent > 1) {
        return this.advice('long');
    }
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