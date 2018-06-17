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
    this.lookbackIndex=4;

    tu.normalizer=100;
    tu.roundPoint=6;

    this.perceptron = new neataptic.architect.Perceptron(4,3,1);
    this.perceptronOptions =  {
        //dropout: 0.5,
        clear: true,
        log: 90000,
        shuffle:false,
        iterations: 90000,
        error: 0.0000000001,
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
        var inputCandle = this.candleHistory.slice(-this.lookbackIndex-1,-1);
        myObj['input'] = tu.getLookbackInput(inputCandle);
        myObj['output'] = [tu.getOutput(candle)];
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

    var inputCandle = tu.getLookbackInput(this.candleHistory.slice(-this.lookbackIndex));
    var predictValue = this.perceptron.activate(inputCandle);
    var predictPercent = tu.getPercent(predictValue, tu.getOutput(candle));

    log.info("input: "+tu.getOutput(candle));
    log.info("input list: "+inputCandle);

    log.info("predict: "+predictValue+" %: "+predictPercent);

    if(!this.open_order && predictPercent > 2) {
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