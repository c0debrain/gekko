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
    this.name = '007';
    this.requiredHistory = config.tradingAdvisor.historySize;
    this.price = 0;
    this.open_order = false;

    this.lookbackPeriod=3;
    this.lookbackData = [];

    // preprate neural network
    this.network = new neataptic.architect.LSTM(1,9,1);
    this.trainingData = [];
    this.obj = {};
}

// what happens on every new candle?
method.update = function(candle) {

    this.obj['input'] = [candle.open]; // divide with 20k, normalizing our input and output
    this.obj['output'] = [candle.close];

    // train the neural network
    this.trainingData.push(this.obj);

    //if(this.trainingData.length >= this.requiredHistory) {
        log.info("starting to train: "+this.trainingData.length);
        this.network.train(this.trainingData, {
            log: 1000,
            iterations: 10000,
            error: 0.000001,
            rate: 0.03,
            clear: true
        });
    //}
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
    var predicted_value = this.network.activate(candle.close);

    // % change in current close and predicted close
    var percentage = ((predicted_value-candle.close)/candle.close)*100;
    log.info("percentage: "+percentage);
    if(percentage > 300 && !this.open_order)
    {
        log.info("Buy: $"+candle.close);
        this.price = candle.close;
        this.open_order = true;
        return this.advice('long');

    }else if(this.open_order){
        this.open_order = false;
        log.info("Sold: $"+candle.close);
        return this.advice('short');

    }

    return this.advice();
}

module.exports = method;