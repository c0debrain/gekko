// npm install neataptic --save
const neataptic = require('neataptic')
const _ = require('lodash');
const config = require ('../core/util.js').getConfig();
const async = require ('async');
const log = require('../core/log.js');
const fs = require('fs');
const cs = require('../modules/candlestick.js');
const moment = require('moment');

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
    this.lookbackIndex = 7;//this.settings.lookback_period;
    //log.debug(this.tradingAdvisor);
    //log.debug(config);


    this.weights = null;

    this.normalizer = 10;
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

    this.totalProfit=0;

    this.trainCount = 0;

    this.perceptOptions = {
        //dropout: 0.5,
        //clear: true,
        log: 1000,
        shuffle:true,
        iterations: 3000,
        error: 0.0000000000001,
        rate: 0.01,
    };

    this.evolveOptions = {
        mutation: neataptic.methods.mutation.FFW,
        equal: true,
        popsize: 1000,
        elitism: 100,
        log: 1000,
        error: 0.0000000000001,
        iterations: 10000,
        mutationRate: 0.001
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

    //have weights no need to train
    //if(this.weights!=null || this.trainingData.length >= this.requiredHistory) {
    //if(this.trainingData.length >= this.requiredHistory) {
      //  return;
    //}

    //prepare input for training

    if(!this.isValidCandle(candle)) {
        return;
    }

    if(this.lookbackData.length < this.lookbackIndex) {
        this.lookbackData.push(candle);
        return;
    } else if (this.lookbackData.length > this.lookbackIndex ) {
        this.lookbackData.shift();
    }

    var myObj = {};
    myObj['input'] = this.getLookbackInput(this.lookbackData);
    //var out =  candle.close - this.lookbackData[this.lookbackData.length-1].close > 0 ? 1 : 0;
    //myObj['output'] = [out];

    myObj['output'] = [candle.close];

    //remember this candel for next time
    this.lookbackData.push(candle);

    // train the neural network
    //log.info("pushing training data:");
    //log.info(this.obj);

    this.trainingData.push(myObj);

    this.trainGap++;

    if(this.trainingData.length > this.requiredHistory) {
        this.trainingData.shift();
    }
    //log.info("Pushing train data "+this.trainCounter++);

    //log.info("update called: trainDataSize: "+this.trainingData.length);

    if(this.trainingData.length >= this.requiredHistory && this.trainGap >= this.requiredHistory/1) {
        //if(this.trainingData.length >= this.requiredHistory && !this.weights != null) {
        //if(this.trainingData.length >= this.requiredHistory && !this.open_order) {

        log.info("Staring to train: "+this.trainingData.length+" count: "+ ++this.trainCount);
        log.info("Train end: "+moment.utc(candle.start).toDate());

        //var errorRange = this.computeTrainingErrorRage(this.trainingData);
        //log.info("Training error range: "+errorRange);

        //log.info("Start: "+this.trainingData[0].start+"End: "+this.trainingData[this.requiredHistory-1].start);
        this.network = new neataptic.architect.Perceptron(
            4*this.lookbackIndex,4, 1
        );

        //evolve
        // this.network = new neataptic.Network(4*this.lookbackIndex, 1);

        //log.info(this.trainingData);

        //perceptron
        this.network.train(this.trainingData, this.perceptOptions);
        this.trainGap = 0;

        //evolve
        //(async ()=>{
          //  await this.network.evolve(this.trainingData, this.evolveOptions);
        //})();

        //log.info("Done training .. writing weights to file:");
        //this.writeToFile();
    }

}

// check is executed after the minimum history input
method.check = function(candle) {

    if (this.trainingData.length < this.requiredHistory && this.weights==null) {
        return;
    }

    this.lookbackCheckData.push(candle);
    if(this.lookbackCheckData.length < this.lookbackIndex ) {
        return;
    } else if(this.lookbackCheckData.length > this.lookbackIndex ) {
        this.lookbackCheckData.shift();
    }

    this.lookbackCheckInput = this.getLookbackInput(this.lookbackCheckData);

    var predictValue = this.network.activate(this.lookbackCheckInput)

    // % change in current close and predicted close
    var predictPercent = ((predictValue-candle.close)/candle.close)*100;
    var profitPercent = this.getCurrentProfitPercent(candle);

    if(
        !this.open_order  && !this.locked && predictPercent > 1.3
    ) {
        //log.info("Buy: $"+candle.close+" expected percent: "+percentage);
        log.info("Buy: $"+candle.close+" expected: "+predictValue+" expect%: "+predictPercent);
        //log.info(this.lookbackCheckInput);
        this.price = candle.close;
        this.pricePredictPercent = predictPercent;
        this.open_order = true;
        this.buyDate = candle.start;
        return this.advice('long');

    } else if( this.open_order
                && ((predictPercent < 0 || profitPercent > 1.5))
            //actual profit is dropping
            //(profitPercent < this.pastProfitPercent && profitPercent > 1.5))
    ){
        this.open_order = false;
        log.info("Sold: $"+candle.close+" expected: "+predictValue+" percent: "+predictPercent+" profit%: "+profitPercent);
        this.totalProfit+=profitPercent;
        this.price=0;
        return this.advice('short');

    //sell and lock account
    } else if (this.open_order  &&
        (this.buyHoursDiff(candle) > 6 && profitPercent < 0 && this.pastProfitPercent > profitPercent))
    {
        this.open_order = false;
        this.locked = true;
        log.info("Lock Sold: $"+candle.close+" expected: "+predictValue+" percent: "+predictPercent+" profit%: "+profitPercent);
        return this.advice('short');

    //unlock
    } else if(this.locked && (predictPercent < 0)) {
        log.info("Unlock: "+candle.close+" expected: "+predictValue+" expect%: "+predictPercent);
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
        lookbackInput.push(lookbackData[i].open);
        lookbackInput.push(lookbackData[i].close);
        lookbackInput.push(lookbackData[i].high);
        lookbackInput.push(lookbackData[i].low);
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


method.log = function() {

}

module.exports = method;
