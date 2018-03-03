// npm install neataptic --save
const neataptic = require('neataptic')
const _ = require('lodash');
const config = require ('../core/util.js').getConfig();
const async = require ('async');
const log = require('../core/log.js');
const fs = require('fs');
const cs = require('../modules/candlestick.js');
const moment = require('moment');
const rf = require('ml-random-forest');

/* Candle information
 { id: 103956,
 start: moment("2018-02-04T00:00:00.000"),
 open: 9080.49,
 high: 9218.98,
 low: 9022,
 close: 9199.96,
 vwp: 9097.252446880359,
 volume: 802.5146890000001,
 trades: 8086 }
 */

//performance data
//4,3,1
//2017-12-16 00:51

//11 min, 200, 338%
//13 min, 200, 329%;

//3min, 1000, 369%, 146trades

// let's create our own method
var method = {};

// prepare everything our method needs
method.init = function() {
    this.weightFileName = "weights/lookbackPercept-ethtrx-lab.json";
    //this.weightFileName = "weights/lookbackPercept-ethtrx-1-1-3-2500-2-10-12p.json";
    //this.weightFileName = "weights/lookbackPercept-ethtrx-3-2400-2-10-10p.json";
    //this.weightFileName = "weights/lookbackPercept-ethxrp.json";
    //this.weightFileName = "weights/staticPercept-ethxrp-13-400-2018-02-13-07-35-3p.json";
    //this.weightFileName = "weights/staticPercept.json";
    //this.weightFileName = "weights/staticPercept-11-200-338p.json";
    //this.weightFileName = "weights/staticPercept-3-400-392p.json";

    //log.debug(this.settings.weight_file);
    this.lookbackIndex = 5;//this.settings.lookback_period;
    //log.debug(this.tradingAdvisor);
    //log.debug(config);

    this.lockSell = false;

    this.roundPoint = 10;

    this.weights = null;

    this.normalizer = 100;
    this.name = '007';
    this.requiredHistory = config.tradingAdvisor.historySize;

    log.info("minimum history: "+this.requiredHistory);

    this.trainGap=0;

    this.price = 0;
    this.pricePredictPercent = 0;
    //history
    this.pastProfitPercent = 0;

    this.open_order = false;
    this.locked = false;

    this.network=null;
    //NOTE: comment out to train and save
    //this.weights = this.readFromFile(this.weightFileName);

    //use to train
    this.lookbackData = [];
    this.trainingData = [];

    //use to activate
    this.lookbackCheckData = [];
    this.lookbackCheckInput = [];

    this.trainInput = [];
    this.trainOutput = [];
    this.regression = null;

    this.totalProfit=0;

    this.trainCount = 0;

    this.rfOptions = {
        seed: 4,
        maxFeatures: 4,
        replacement: true,
        nEstimators: 200
    };

    log.info("**************************************");
    if(this.weights!=null) {

      log.info("***** Creating network from file *****");
      this.network = neataptic.Network.fromJSON(this.weights);

    } else {
      // preprate neural network
      log.info("*** Training network from scratch ****");

        //this.network = new neataptic.architect.LSTM(4,16,1);
        // this.network = new neataptic.Network(4*this.lookbackIndex, 1);
        //this.network = new neataptic.architect.NARX(4*this.lookbackIndex, [10,20,10], 1, 10, 10);
    }
    log.info("**************************************");
}


// what happens on every new candle?
method.update = function(candle) {

    if(!this.isValidCandle(candle)) {
        return;
    }

    if(this.lookbackData.length < this.lookbackIndex) {
        this.lookbackData.push(candle);
        return;
    } else if (this.lookbackData.length > this.lookbackIndex ) {
        this.lookbackData.shift();
    }


    this.trainInput.push(this.getLookbackInput(this.lookbackData));
    this.trainOutput.push(this.getOutput(candle));

    //remember this candel for next time
    this.lookbackData.push(candle);

    this.trainGap++;

    if(this.trainInput.length > this.requiredHistory) {
        //this.trainInput.shift();
        //this.trainOutput.shift();
    }

    //log.info("Pushing train data "+this.trainCounter++);
    //log.info("update called: trainDataSize: "+this.trainingData.length);

    if(this.trainInput.length >= this.requiredHistory ) {
        //if(this.trainingData.length >= this.requiredHistory && !this.weights != null) {
        //if(this.trainingData.length >= this.requiredHistory && !this.open_order) {

        //log.info("*************** Training DATA ***************")
        //log.info("Staring to train: "+this.trainInput.length+" count: "+ ++this.trainCount);
        //log.info("Train out: "+this.trainOutput.length);
        //log.info(this.trainInput);
        //log.info(this.trainOutput);
        //log.info("Train end: "+getDate(candle));

        this.regression = new rf.RandomForestRegression(this.rfOptions);
        this.regression.train(this.trainInput, this.trainOutput);
        this.trainGap = 0;
    }

}


// check is executed after the minimum history input
method.check = function(candle) {

    //log.info("tring to check:");
    this.lookbackCheckData.push(candle);

    if (this.trainInput.length < this.requiredHistory && this.weights==null) {
        if(this.lookbackCheckData.length > this.lookbackIndex) {
            this.lookbackCheckData.shift();
        }
        return;
    }

    if(this.lookbackCheckData.length < this.lookbackIndex ) {
        return;
    } else if(this.lookbackCheckData.length > this.lookbackIndex ) {
        this.lookbackCheckData.shift();
    }

    this.lookbackCheckInput = [];
    this.lookbackCheckInput.push(this.getLookbackInput(this.lookbackCheckData));

    //log.info("Checking for:");
    //log.info(this.lookbackCheckInput);

    //var predictValue = this.network.activate(this.lookbackCheckInput);

    var predictValue = this.regression.predict(this.lookbackCheckInput);
    predictValue = round(predictValue,this.roundPoint);

    //log.info("predict value: "+predictValue);

    // % change in current close and predicted close
    var normalizedClose = candle.close * this.normalizer;
    var predictPercent = ((predictValue-normalizedClose)/normalizedClose)*100;
    //log.info("Predict%: "+predictPercent);
    //var predictPercent = predictValue;

    var profitPercent = this.getCurrentProfitPercent(candle);

    if(
        !this.open_order  && !this.locked && predictPercent > 1
    ) {
        //log.info("Buy: $"+candle.close+" expected percent: "+percentage);
        log.info("Buy: $"+candle.close+" predict: "+predictValue+" predict%: "+predictPercent);
        log.info(">> Candle date: "+getDate(candle));
        //log.info(this.lookbackCheckInput);
        this.price = candle.close;
        this.pricePredictPercent = predictPercent;
        this.open_order = true;
        this.buyDate = candle.start;
        return this.advice('long');

    } else if( this.open_order
                && ((predictPercent < 0 || profitPercent > 1.6))
            //actual profit is dropping
            //(profitPercent < this.pastProfitPercent && profitPercent > 1.5))
    ){
        this.open_order = false;
        log.info("Sold: $"+candle.close+" predict: "+predictValue+" predict%: "+predictPercent+" profit%: "+profitPercent);
        log.info("<< Candle date: "+getDate(candle));
        this.totalProfit+=profitPercent;
        this.price=0;
        return this.advice('short');

    //sell and lock account
    } else if (this.open_order  && this.lockSell
        && (this.buyHoursDiff(candle) > 6 && profitPercent < -1 && profitPercent < this.pastProfitPercent))
    {
        this.open_order = false;
        this.locked = true;
        log.info("Lock Sold: $"+candle.close+" predict: "+predictValue+" predict%: "+predictPercent+" profit%: "+profitPercent);
        return this.advice('short');

    //unlock
    } else if(this.locked && (predictPercent < 0)) {
        log.info("Unlock: "+candle.close+" predict: "+predictValue+" predict%: "+predictPercent);
        this.locked = false;
    }

    this.pastProfitPercent = profitPercent;

    return this.advice();
}


method.buyHoursDiff = function(candle) {
    var a = moment(candle.start);
    var b = moment(this.buyDate);
    return a.diff(b,'hours');
}


method.getCurrentProfitPercent = function(candle) {
    if(this.price == 0)
        return 0;
    return ((candle.close - this.price)/this.price)*100;
}

method.getLookbackInput = function(lookbackData) {
    var lookbackInput = [];
    for(var i=0;i<lookbackData.length;i++) {
        //lookbackInput.push(lookbackData[i].open * this.normalizer);
        //lookbackInput.push(lookbackData[i].high * this.normalizer);
        lookbackInput.push(round(lookbackData[i].close * this.normalizer,this.roundPoint));
        //lookbackInput.push(lookbackData[i].close * this.normalizer);
    }
    return lookbackInput;
}


method.computeTrainingErrorRage= function(trainingData) {
    var trainingErrorRange = 0;
    for(var i=0;i<trainingData.length;i++) {
        trainingErrorRange += trainingData[i]['output'][0];
    }
    return (trainingErrorRange/trainingData.length)/100;
}


method.isBullish = function(candles) {
    for(var i=0;i<candles.length;i++) {
        if (!cs.isBullish(candles[i])) {
            return false;
        }
    }
    return candles[candles.length-1].close > candles[0].close;
}


method.isUptrend = function(candles) {
    return candles[0].close < candles[candles.length-1].close;
}

method.isValidCandle = function(candle) {
    return !(candle.open == candle.close &&
           candle.close == candle.high &&
           candle.high == candle.low);
}

method.writeToFile = function() {
    const exported = this.network.toJSON();
    const content = JSON.stringify(exported);
    fs.writeFile(this.weightFileName, content, function(err, data){
        if (err) console.log(err);
        console.log("Successfully Written to File.");
    });
}

method.readFromFile = function(filePath) {
    var data = fs.readFileSync(filePath,'utf8');
    return JSON.parse(data);
}

method.getOutput = function(candle) {
    return round(candle.close * this.normalizer, this.roundPoint);
}

function round(value, decimals) {
    return Number(Math.round(value+'e'+decimals)+'e-'+decimals);
}

function getDate(candle) {
    return moment.utc(candle.start).format();
}

method.log = function() {
}

module.exports = method;
