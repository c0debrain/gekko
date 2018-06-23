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

    // preprate neural network
    this.network = new neataptic.architect.LSTM(1,9,1);
    this.trainingData = [];
    this.obj = {};
}

// what happens on every new candle?
method.update = function(candle) {

    this.obj['input'] = [candle.open * 1000]; // divide with 20k, normalizing our input and output
    this.obj['output'] = [candle.close * 1000];

    // train the neural network
    this.trainingData.push(this.obj);
    this.network.train(this.trainingData, {
        log: 1000,
        iterations: 10000,
        error: 0.003,
        rate: 0.005,
        clear: true
    });

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

    var currentPrice = candle.close * 1000;
    //let's predict the next close price on the current close price;
    var predicted_value = this.network.activate(currentPrice);

    // % change in current close and predicted close
    var percentage = ((predicted_value-currentPrice)/currentPrice)*100;

    log.info("currentPrice: "+currentPrice);
    log.info("Predict: "+predicted_value+" %: "+percentage);

    if(!this.open_order && percentage > 2) {
        log.info("Buy: $"+candle.close);
        this.price = candle.close;
        this.open_order = true;
        return this.advice('long');

    } else if(this.open_order && percentage < 0.5) {
        this.open_order = false;
        log.info("Sold: $"+candle.close);
        return this.advice('short');
    }

    return this.advice();
}

module.exports = method;