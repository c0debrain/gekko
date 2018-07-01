// npm install neataptic --save
const neataptic = require('neataptic')
const _ = require('lodash');
const config = require ('../core/util.js').getConfig();
const async = require ('async');
const log = require('../core/log.js');

const cs = require('../modules/candlestick.js');
const tu = require('../modules/tradeutil.js');
const ts = require("timeseries-analysis");

// let's create our own method
var method = {};

// prepare everything our method needs
method.init = function() {
    this.name = '007';
    this.requiredHistory = config.tradingAdvisor.historySize;
    this.price = 0;
    this.open_order = false;

    // preprate neural network
    this.network = new neataptic.architect.LSTM(1,6,1);
    this.networkOptions = {
        log: 9000,
        iterations: 10000,
        error: 0.0000001,
        rate: 0.00001,
        clear: true,
        momentum: 0.9,
    };
    this.trainingData = [];
    this.obj = {};
}

// what happens on every new candle?
method.update = function(candle) {

    this.obj['input'] = [candle.open * 1000];
    this.obj['output'] = [candle.close * 1000];

    // train the neural network
    this.trainingData.push(this.obj);
    log.info("training");
    this.network.train(this.trainingData, this.networkOptions);

}

// check is executed after the minimum history input
method.check = function(candle) {

    var self = this;
    var currentPrice = candle.close * 1000;
    //let's predict the next close price on the current close price;
    var predictValue = this.network.activate(currentPrice);
    // % change in current close and predicted close
    var predictPercent = ((predictValue-currentPrice)/currentPrice)*100;

    log.info("****** Check ******");
    log.info("Date: "+tu.getDate(candle));
    log.info("currentPrice: "+currentPrice);
    log.info("Predict: "+predictValue+" %: "+predictPercent);


    if(!this.open_order && predictPercent > .5) {
        log.info("Buy: $"+candle.close);
        this.price = candle.close;
        this.open_order = true;
        return this.advice('long');

    } else if(this.open_order && predictPercent < 0.2) {
        this.open_order = false;
        log.info("Sold: $"+candle.close);
        return this.advice('short');
    }

}

method.end = function() {
    log.info("**** End ****");
}

method.log = function() {

}

module.exports = method;