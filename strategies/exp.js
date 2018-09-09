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

    this.fileDelim = "weights/";//+this.settings.fileDelim;
    this.weightFileName = this.fileDelim+"exp-weights.json";
    this.candleHistoryFileName = this.fileDelim+"exp-candleHistory.json";
    this.trainingDataFileName = this.fileDelim+"exp-trainingData.json";


    config.debug = false;
    this.open_order = false;
    this.candleHistory=[];
    this.trainingData=[];
    this.requiredHistory = config.tradingAdvisor.historySize;
    this.lookbackIndex = this.settings.lookbackIndex;
    this.price=0;
    this.previousProfitPercent=0;
    this.trainCounter=0;
    this.trainPeriod = this.settings.trainPeriod;
    this.totalProfitPercen=0;

    this.actionCounter = 0;

    tu.normalizer = this.settings.normalizer;
    tu.roundPoint = this.settings.roundPoint;

    this.weights ;//= tu.readJsonFromFile(this.weightFileName);
    this.perceptron = new neataptic.architect.Perceptron(this.lookbackIndex,2,1);

    if(this.weights!=null) {
        log.info("creating network from file");
        this.perceptron = neataptic.Network.fromJSON(this.weights);
    }

    this.perceptronOptions =  {
        //dropout: 0.5,
        clear: true,
        log: 20000,
        shuffle:false,
        iterations:  this.settings.iterations,
        error:  this.settings.error,
        rate:  this.settings.rate,
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

    var buyMOMSettings = {
        optInTimePeriod:this.settings.mom
    };
    // add the indicator to the strategy
    this.addTalibIndicator('buyMom', 'mom', buyMOMSettings);

    var sellMOMSettings = {
        optInTimePeriod: this.settings.mom / 2
    };
    // add the indicator to the strategy
    this.addTalibIndicator('sellMom', 'mom', sellMOMSettings);

    var linearreg_slopeSettings = {
        optInTimePeriod: this.settings.mom
    }
    this.addTalibIndicator('slope', 'linearreg_slope', linearreg_slopeSettings);

    var linearreg_slopeSettings_sell = {
        optInTimePeriod: this.settings.mom/3
    }
    this.addTalibIndicator('sellSlope', 'linearreg_slope', linearreg_slopeSettings_sell);

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

    if(this.trainingData.length >= this.requiredHistory && this.trainCounter >= this.trainPeriod) {

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

    var isTotalUptrend = tu.isTotalUptrend(inputCandle);
    var predictPercent = tu.getPercent(predictValue, tu.getOutput(candle));
    var currentPrice = tu.getOutput(candle);
    var currentProfitPercent = tu.getPercent(currentPrice,this.price);
    var self = this;

    var buyMom = this.talibIndicators.buyMom.result['outReal'] * 1000;
    var sellMom = this.talibIndicators.sellMom.result['outReal'] * 1000;
    var slope = this.talibIndicators.slope.result['outReal'] * 1000;
    var sellSlope = this.talibIndicators.sellSlope.result['outReal'] * 1000;

    //log.info("predictEvolve: "+predictValueEvolve);

    if(shouldBuy()) {
        this.actionCounter ++;
        log.info("************* Buy "+this.actionCounter+"*************");
        this.open_order = true;
        this.price = currentPrice;
        printDebugInfo();
        return this.advice('long');

    } else if(shouldSell()) {
        log.info("************* Sell "+this.actionCounter+"*************");
        log.info("price: "+this.price+" sell: "+currentPrice+" profit%: "+currentProfitPercent);
        this.totalProfitPercen += currentProfitPercent;
        this.open_order = false;
        printDebugInfo();
        return this.advice('short');
    }


    this.previousProfitPercent = currentProfitPercent;

    function shouldBuy(){
        return !self.open_order
                //&& cs.isBullishHammerLike(candle)
                && cs.isBullish(candle)
                && buyMom > .000001
                && slope > 0
                //&& predictPercent > 1;
    }

    function shouldSell(){
        return self.open_order
            //&& !isTotalUptrend
            && slope < 0
            //&& (sellMom < 0 || (slope < 0 && (currentProfitPercent < self.previousProfitPercent)))
    }

    function printDebugInfo() {
        log.info("input: "+currentPrice);
        log.info("input list: "+inputCandle);
        log.info("price: "+self.price);
        log.info("currentProfit% :"+currentProfitPercent);
        log.info("previousProfit%: "+self.previousProfitPercent);
        log.info("predict: "+predictValue+" %: "+predictPercent);
        log.info("isTotalUpTrend: "+isTotalUptrend);
        log.info("buyMom: "+buyMom);
        log.info("sellMom: "+sellMom);
        log.info("slope: "+slope);
        log.info("sellSlope: "+sellSlope);
    }

}




strat.end = function() {
    log.info("**** End ****");
    if(this.weights != null) {
        //tu.writeJsonToFile(this.perceptron.toJSON(), this.weightFileName);
    }
    //tu.writeJsonToFile(this.candleHistory, this.candleHistoryFileName);
    //tu.writeJsonToFile(this.trainingData, this.trainingDataFileName);
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