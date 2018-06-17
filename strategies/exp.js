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
        log: 90000,
        shuffle:false,
        iterations: 90000,
        error: 0.00000000001,
        rate: 0.03,
        momentum: 0.9,
        batchSize:  this.requiredHistory
    };
}


strat.update = function(candle) {
    this.candleHistory.push(candle);
    log.info("*** update ***");
    log.info("candle history: "+this.candleHistory.length);
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
        log.info("*** training start ***");
        //console.log(this.trainingData);
        this.perceptron.train(this.trainingData,this.perceptronOptions);
    }
}


strat.check = function(candle) {

    if(this.trainingData.length < this.requiredHistory) {
        return;
    }

    log.info("*** check ***");
    log.info("candle history: "+this.candleHistory.length);
    log.info("candle date: "+tu.getDate(candle));

    var predictValue = this.perceptron.activate([candle.open,candle.close,candle.high,candle.low]);
    var predictPercent = tu.getPercent(predictValue, candle.close);

    log.info("input: "+candle.close);
    log.info("predict: "+predictValue+" %: "+predictPercent);

    if(!this.open_order && predictPercent > 0) {
        log.info("************* Buy *************");
        this.open_order = true;
        return this.advice('long');

    } else if(this.open_order && predictPercent < 0) {
        log.info("************* Sell *************");
        this.open_order = false;
        return this.advice('short');
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