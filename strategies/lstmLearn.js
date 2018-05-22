// npm install neataptic --save
const neataptic = require('neataptic')
const _ = require('lodash');
const config = require ('../core/util.js').getConfig();
const async = require ('async');
const log = require('../core/log.js');
const tu = require('../modules/tradeutil.js');

// let's create our own method
var method = {};

// prepare everything our method needs
method.init = function() {

    tu.normalizer = 1000;
    tu.roundPoint = 7;

    this.name = '007';
    this.requiredHistory = config.tradingAdvisor.historySize;
    this.price = 0;
    this.open_order = false;

    // preprate neural network
    this.network = new neataptic.architect.LSTM(1,6,1);
    //this.network = new neataptic.architect.NARX(1, 5, 1, 50, 50);
    this.trainingData = [];
    this.previous = null;
    this.trainResult = null;
    this.previousProfitPercent=0;
}

// what happens on every new candle?
method.update = function(candle) {
    if(this.previous==null){
        this.previous = candle.close;
        return;
    }

    var myObj = {};
    myObj['input'] = [tu.getNorm(this.previous)];
    myObj['output'] = [tu.getNorm(candle.close)];

    // train the neural network
    this.trainingData.push(myObj);
    this.previous = candle.close;

    if(this.trainingData.length > this.requiredHistory) {
        this.trainingData.shift();
    }

    if(this.trainingData.length >= this.requiredHistory) {

        log.info("starting to train: "+this.trainingData.length);
        //log.info(this.trainingData);

        this.trainResult = this.network.train(this.trainingData, {
            clear: true,
            log: 10000,
            iterations: 300000,
            error: 0.00005,
            rate: 0.000005,
            momentum: 0.9
        });
        //console.log(this.trainResult);
    }

}


// check is executed after the minimum history input
method.check = function(candle) {

    if(this.trainingData.length < this.requiredHistory) {
        return;
    }

    log.info("tring to predict");
    log.info("****************");

    //let's predict the next close price on the current close price;
    var normClose = tu.getNorm(candle.close);
    var predicted_value = this.network.activate(normClose);
    // % change in current close and predicted close
    var percentage = tu.getPercent(predicted_value,normClose);
    var currentProfitPercent = tu.getPercent(normClose,this.price);

    log.info("price: "+tu.getNorm(candle.close));
    log.info("predict: "+predicted_value);
    log.info("percentage: "+percentage);
    log.info("profit: "+currentProfitPercent);
    log.info("previous profit: "+this.previousProfitPercent);


    if(percentage > 1 && !this.open_order) {
        log.info("**** Buy: $"+candle.close);
        this.price = tu.getNorm(candle.close);
        this.open_order = true;
        return this.advice('long');

    } else if(this.open_order && percentage < 0 ){
        this.open_order = false;
        log.info("**** Sold: $"+candle.close);
        return this.advice('short');
    }

    this.previousProfitPercent = currentProfitPercent;
    return this.advice();
}

method.log = function() {

}

module.exports = method;