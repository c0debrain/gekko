// npm install neataptic --save
const neataptic = require('neataptic')
const _ = require('lodash');
const config = require ('../core/util.js').getConfig();
const async = require ('async');
const log = require('../core/log.js');
const fs = require('fs');

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
    this.weightFileName = "weights/lookbackPercept-ethtrx-labp2.json";

    this.weights = null;

    this.normalizer = 10;
    this.roundPoint = 10;

    this.name = '007';
    this.requiredHistory = config.tradingAdvisor.historySize;

    log.info("minimum history: "+this.requiredHistory);
    this.price = 0;
    this.open_order = false;

    this.network=null;

    //use to train
    this.lookbackIndex = 3;
    this.lookbackData = [];

    this.trainingData = [];

    //use to activate
    this.lookbackCheckData = [];
    this.lookbackCheckInput = [];

    this.perceptOptions = {
        //dropout: 0.5,
        //clear: true,
        log: 1000,
        shuffle:true,
        iterations: 10000,
        error: 0.00000000001,
        rate: 0.03,
    };


    log.info("**************************************");
    if(this.weights!=null) {
      log.info("***** Creating network from file *****");
      this.network = neataptic.Network.fromJSON(this.weights);
    } else {
      // preprate neural network
      log.info("*** Training network from scratch ****");

        this.network = new neataptic.architect.Perceptron(
          4*this.lookbackIndex, 1, 1
        );
    }
    log.info("**************************************");

}


// what happens on every new candle?
method.update = function(candle) {

    if(!this.isValidCandle(candle)) {
        return;
    }

    //have weights no need to train
    if(this.weights!=null || this.trainingData.length >= this.requiredHistory) {
        return;
    }

    //prepare input for training
    if(this.lookbackData.length < this.lookbackIndex) {
        this.lookbackData.push(candle);
        return;
    } else if (this.lookbackData.length > this.lookbackIndex ) {
        this.lookbackData.shift();
    }

    var myObj = {};
    myObj['input'] = this.getLookbackInput(this.lookbackData);
    myObj['output'] = [this.getOutput(candle)];

    //remember this candel for next time
    this.lookbackData.push(candle);

    this.trainingData.push(myObj);

    if(this.trainingData.length == this.requiredHistory && !this.weights != null) {
        log.info("Staring to train: "+this.trainingData.length);
        //perceptron
        this.network.train(this.trainingData, this.perceptOptions);
        log.info("Done training .. writing weights to file:");
        this.writeToFile();
    }

}


// check is executed after the minimum history input
method.check = function(candle) {

    this.lookbackCheckData.push(candle);

    if (this.trainingData.length < this.requiredHistory && this.weights==null) {
        return this.advice();
    }

    if(this.lookbackCheckData.length < this.lookbackIndex ) {
        return this.advice();
    } else if(this.lookbackCheckData.length > this.lookbackIndex ) {
        this.lookbackCheckData.shift();
    }

    this.lookbackCheckInput = this.getLookbackInput(this.lookbackCheckData);

    //no normalizer
    var predicted_value = this.network.activate(this.lookbackCheckInput);

    // % change in current close and predicted close
    var percentage = ((predicted_value-candle.close)/candle.close)*100;


    if(percentage > 1.5 && !this.open_order)
    {
        log.info("Buy: $"+candle.close+" expected: "+predicted_value+" percent: "+percentage);
        this.price = candle.close;
        this.open_order = true;
        return this.advice('long');

    } else if(this.open_order && (percentage < 0 || this.getCurrentProfit(candle) > 1.15)){
    //} else if(this.open_order && predicted_value < .5){
        this.open_order = false;
        //log.info("Sold: $"+candle.close+" expected percent: "+percentage);
        log.info("Sold: $"+candle.close+" expected: "+predicted_value+" percent: "+percentage);
        return this.advice('short');
    }

    return this.advice();
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

method.isValidCandle = function(candle) {
    return !(candle.open == candle.close &&
    candle.close == candle.high &&
    candle.high == candle.low);
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
