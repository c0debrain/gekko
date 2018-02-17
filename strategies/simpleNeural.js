// npm install neataptic --save
const neataptic = require('neataptic')
const _ = require('lodash');
const config = require ('../core/util.js').getConfig();
const async = require ('async');
const log = require('../core/log.js');

// let's create our own method
var method = {};

// prepare everything our method needs
method.init = function() {
    this.normalizer = 10;
    this.name = '007';
    this.requiredHistory = config.tradingAdvisor.historySize;
    this.trainCounter=0;
    log.info("minimum history: "+this.requiredHistory);
    this.price = 0;
    this.open_order = false;

    // preprate neural network
    this.network = new neataptic.architect.Perceptron(4,3,1);
    //this.network = new neataptic.architect.LSTM(4,16,1);
    this.trainingData = [];
    this.obj = {};

    this.previousCandle = null;
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
    this.trainingData.push(this.obj);
    //log.info("Pushing train data "+this.trainCounter++);
    this.trainCounter++;

    if(this.trainCounter == this.requiredHistory ) {
      log.info("Staring to train");
      log.info(this.obj['input']);
      log.info(this.obj['output']);

      //perceptron
      this.network.train(this.trainingData, {
          //dropout: 0.5,
          //clear: true,
          shuffle:true,
          log: 0,
          iterations: 100000,
          error: 0.00000000001,
          rate: 0.03,

      });
  }

}


method.log = function() {

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

    //no normalizer
    var predicted_value = this.network.activate([candle.open,candle.close,candle.high,candle.close]);

    // % change in current close and predicted close
    var percentage = ((predicted_value-candle.close)/candle.close)*100;

    //log.info("=========================================");
    //log.info("Checking for candle: "+candle.start+" Close: "+candle.close);
    //log.info("Predicted value: "+predicted_value);
    //log.info("Percent: "+percentage);

    if(percentage > 1 && !this.open_order)
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
