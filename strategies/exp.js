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
    this.price=0;
    this.previousProfitPercent=0;
    this.trainCounter=0;
    this.trainGap=0;
    this.totalProfitPercen=0;

    tu.normalizer=100;
    tu.roundPoint=6;

    this.perceptron = new neataptic.architect.Perceptron(this.lookbackIndex,2,1);
    this.perceptronOptions =  {
        //dropout: 0.5,
        clear: true,
        log: 90000,
        shuffle:false,
        iterations: 10000,
        error: 0.000000001,
        rate: 0.03,
        momentum: 0.9,
        batchSize:  this.requiredHistory
    };

    this.evolveNet = new neataptic.Network(this.lookbackIndex, 1);
    this.evolveOptions = {
        mutation: neataptic.methods.mutation.ALL,
        amount:5,
        mutationRate: 0.004,
        clear: true,
        cost: neataptic.methods.cost.MSE,
        log: 90000,
        error: 0.000000001,
        iterations: this.settings.iterations
    };
}


strat.update = function(candle) {
    this.candleHistory.push(candle);

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

    this.trainCounter++;

    if(this.trainingData.length >= this.requiredHistory && this.trainCounter >= this.trainGap) {

        this.trainCounter=0;
        log.info("************  training start ************");
        log.info("Date: "+tu.getDate(candle));
        log.info("Total profit: "+this.totalProfitPercen);

        //console.log(this.trainingData);
        this.perceptron.train(this.trainingData,this.perceptronOptions);

        /*
        (async ()=> {
            await this.evolveNet.evolve(this.trainingData, this.evolveOptions);
            log.info("trying to train");
        })();
        */
    }
}


strat.check = function(candle) {

    if(this.trainingData.length < this.requiredHistory) {
        return;
    }

    log.info("*** check ***");
    //log.info("candle history: "+this.candleHistory.length);
    //log.info("candle date: "+tu.getDate(candle));

    var inputCandle = tu.getLookbackInput(this.candleHistory.slice(-this.lookbackIndex));

    var predictValue = this.perceptron.activate(inputCandle);
    //var predictValueEvolve = this.evolveNet.activate(inputCandle);

    var predictPercent = tu.getPercent(predictValue, tu.getOutput(candle));
    var currentPrice = tu.getOutput(candle);
    var currentProfitPercent = tu.getPercent(currentPrice,this.price);
    var self = this;

    log.info("input: "+currentPrice);
    log.info("input list: "+inputCandle);
    log.info("predict: "+predictValue+" %: "+predictPercent);
    //log.info("predictEvolve: "+predictValueEvolve);

    if(shouldBuy()) {
        log.info("************* Buy *************");
        this.open_order = true;
        this.price = currentPrice;
        return this.advice('long');

    } else if(shouldSell()) {
        log.info("************* Sell *************");
        log.info("price: "+this.price+" sell: "+currentPrice+" profit%: "+currentProfitPercent);
        this.totalProfitPercen += currentProfitPercent;
        this.open_order = false;
        return this.advice('short');
    }

    this.previousProfitPercent = currentProfitPercent;




    function shouldBuy(){
        return !self.open_order && predictPercent > 1.8;
    }

    function shouldSell(){
        return self.open_order && predictPercent < -0.5;
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