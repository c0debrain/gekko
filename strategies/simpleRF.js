// npm install neataptic --save
const neataptic = require('neataptic')
const _ = require('lodash');
const config = require ('../core/util.js').getConfig();
const async = require ('async');
const log = require('../core/log.js');
const rf = require('ml-random-forest');


// let's create our own method
var method = {};

// prepare everything our method needs
method.init = function() {
    this.normalizer = 10;
    this.name = '007';
    this.requiredHistory = config.tradingAdvisor.historySize;
    this.trainCounter=0
    this.trainGap=0
    log.info("minimum history: "+this.requiredHistory);
    this.price = 0;
    this.open_order = false;

    // preprate neural network
    //this.network = new neataptic.architect.Perceptron(4,8,1);
    //this.network = new neataptic.architect.LSTM(4,16,1);
    this.trainingData = {in:[],out:[]};
    this.obj = {};

    this.previousCandle = null;

    this.rfOptions = {
        seed: 3,
        maxFeatures: 4,
        replacement: false,
        nEstimators: 200
      };

    this.regression = new rf.RandomForestRegression(this.rfOptions);
}

// what happens on every new candle?
method.update = function(candle) {
    //this.obj['input'] = [candle.open/this.normalizer]; // divide with 20k, normalizing our input and output
    //this.obj['output'] = [candle.close/this.normalizer];
    if(this.previousCandle==null) {
        this.previousCandle = candle;
        return;
    }
    this.obj['input'] = [this.previousCandle.open,this.previousCandle.close,
                        this.previousCandle.high,this.previousCandle.low]; // no normalizer
    this.obj['output'] = [candle.close];
    this.previousCandle = candle;
    // train the neural network
    this.trainingData.in.push(this.obj['input']);
    this.trainingData.out.push(this.obj['output']);
    //log.info("Pushing train data "+this.trainCounter++);
    this.trainCounter++;
    this.trainGap++
    if(this.trainCounter >= this.requiredHistory && this.trainGap > this.requiredHistory/4) {
      log.info("Staring to train RF");
      try{
        this.regression = new rf.RandomForestRegression(this.rfOptions);
        console.log("starting to train")
        //console.log(this.trainingData.in)
        this.regression.train(this.trainingData.in,this.trainingData.out)
        this.trainGap=0
      }catch(err) {
          console.log("error training")
      }
  }

}


method.log = function() {
    console.log("doing log")
}

// check is executed after the minimum history input
method.check = function(candle) {

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

    //let's predict the next close price on the current close price;
    //var predicted_value = this.network.activate(candle.close/this.normalizer)*this.normalizer;

    if(this.trainCounter < this.requiredHistory)
        return
    
    log.info("Predict")
    log.info([[candle.open,candle.close,candle.high,candle.low]])
    
    var predicted_value = 0
    // var predicted_value = this.regression
    //   .predict([[candle.open,candle.close,candle.high,candle.low]]);

    // % change in current close and predicted close
    var percentage = ((predicted_value-candle.close)/candle.close)*100;

    log.info("=========================================");
    log.info("Checking for candle: "+candle.start+" Close: "+candle.close);
    log.info("Predicted value: "+predicted_value);
    log.info("Percent: "+percentage);

    if(percentage > 0.01 && !this.open_order)
    {
        log.info("Buy: $"+candle.close);
        this.price = candle.close;
        this.open_order = true;
        return this.advice('long');

    }else if(this.open_order && percentage < 0){
        this.open_order = false;
        log.info("Sold: $"+candle.close);
        return this.advice('short');
    }

    //log.info("return no advice");
    return this.advice();
}

module.exports = method;
