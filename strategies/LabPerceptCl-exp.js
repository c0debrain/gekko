// npm install neataptic --save
//0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377,
// 610, 987, 1597, 2584, 4181, 6765, 10946, 17711, 28657, 46368, 75025, 121393, 196418, 317811,

const neataptic = require('neataptic')
const _ = require('lodash');
const config = require ('../core/util.js').getConfig();
const async = require ('async');
const log = require('../core/log.js');

const cs = require('../modules/candlestick.js');
const tu = require('../modules/tradeutil.js');
const ts = require("timeseries-analysis");

var method = {};

// prepare everything our method needs
method.init = function() {

    this.fileDelim = "weights/"+this.settings.fileDelim;

    this.weightFileName = this.fileDelim+"boot-perceptcl-weight-ethtrx.json";
    this.lookbackDataFileName = this.fileDelim+"boot-lookback-data-ethxrp.json";
    this.trainDataFileName = this.fileDelim+"boot-train-data-ethxrp.json";
    this.lookbackCheckDataFileName = this.fileDelim+"boot-lookback-check-data-ethxrp.json";

    this.name = 'LabPerceptCL-v1';
    this.upCounter = 0;

    this.min=10;
    this.max=0;

    this.trainGap=0;
    this.trained = false;

    this.price = 0;
    this.pricePredictPercent = 0;
    //history
    this.pastProfitPercent = 0;

    this.open_order = false;
    this.network=null;

    //use to train
    this.lookbackData = [];
    this.trainingData = [];

    //use to activate
    this.lookbackCheckData = [];
    this.lookbackCheckInput = [];

    this.totalProfit=0;

    this.debug = this.settings.debug;
    this.buySig = 0;
    this.hitCounter = this.settings.hitCounter;

    this.trainSave = this.settings.trainSave;
    this.weights = null;

    this.shift = true;
    this.lookbackIndex = this.settings.lookbackIndex;
    this.requiredHistory = config.tradingAdvisor.historySize;

    this.trainPeriod = this.settings.trainPeriod;

    log.info("minimum history: "+this.requiredHistory);

    tu.normalizer = this.settings.normalizer;
    tu.roundPoint = this.settings.roundPoint;

    this.perceptOptions = {
        clear: true,
        log: 20000,
        shuffle:false,
        iterations:  this.settings.iterations,
        error:  this.settings.error,
        rate:  this.settings.rate,
        momentum: 0.9,
        batchSize:  this.requiredHistory
    };

    this.getPerceptron = function() {
        return new neataptic.architect.Perceptron(
            1*this.lookbackIndex,2,1
        );
    };

    this.getEvolveNet = function() {
        return new neataptic.Network(1*this.lookbackIndex, 1);
    };

    this.evolveOptions = {
        mutation: neataptic.methods.mutation.ALL,
        amount:5,
        mutationRate: 0.004,
        clear: true,
        cost: neataptic.methods.cost.MSE,
        log: 100,
        error: this.settings.error,
        iterations: this.settings.iterations
    };

    //NOTE: comment out to train and save
    this.weights = tu.readJsonFromFile(this.weightFileName);

    log.info("**************************************");
    if(this.weights!=null && this.trainSave) {

        log.info("***** Creating network from file *****");
        this.network = neataptic.Network.fromJSON(this.weights);

        log.info("init train and predict data");

        this.lookbackData = tu.readJsonFromFile(this.lookbackDataFileName);
        this.trainingData = tu.readJsonFromFile(this.trainDataFileName);
        this.lookbackCheckData = tu.readJsonFromFile(this.lookbackCheckDataFileName);

    } else {
        // preprate neural network
        log.info("*** Training network from scratch ****");

    }
    log.info("**************************************");
}




// what happens on every new candle?
method.update = function(candle) {

    //prepare input for training
    //log.info("start update: "+tu.getDate(candle));

    if(!tu.isValidCandle(candle)) {
        return;
    }

    if(this.lookbackData.length < this.lookbackIndex) {
        this.lookbackData.push(candle);
        return;
    } else if (this.lookbackData.length > this.lookbackIndex ) {
        this.lookbackData.shift();
    }

    var myObj = {};
    myObj['input'] = tu.getLookbackInput(this.lookbackData);
    myObj['output'] = [tu.getOutput(candle)];

    //remember this candel for next time
    this.lookbackData.push(candle);

    this.trainingData.push(myObj);

    this.trainGap++;

    if(this.trainingData.length > this.requiredHistory && this.shift) {
        this.trainingData.shift();
    }


    if(this.trainingData.length >= this.requiredHistory &&  (
        this.trainGap >= this.trainPeriod || this.weights != null)) {

        //set the weight to null
        this.weights = null;

        log.info("*************** Training DATA ***************");
        log.info("Train data size: "+this.trainingData.length);
        log.info("Train end: "+tu.getDate(candle));
        log.info("Train Gap: "+this.trainGap);
        //log.info(this.trainingData);

        this.network = this.getPerceptron();
        //perceptron
        this.perceptOptions.batchSize = this.trainingData.length;
        var result = this.network.train(this.trainingData, this.perceptOptions);

        //log.info("Training done with iteration: "+result.iterations);
        this.trained = true; //result.iterations < this.perceptOptions.iterations ? true : false;
        this.trainGap = 0;
        log.info("Trained: "+this.trained);
        log.info("min max diff: "+tu.getPercent(this.max,this.min));
        log.info("*************** Training DATA END ***************");

        if(this.trainSave) {
            tu.writeJsonToFile(this.network.toJSON(), this.weightFileName);
        }
    } else if(this.trainSave){
        //we loaded network from file
        this.trained = true;
    }

    if(this.trainSave) {
        tu.writeJsonToFile(this.lookbackData, this.lookbackDataFileName);
        tu.writeJsonToFile(this.trainingData, this.trainDataFileName);
        tu.writeJsonToFile(this.lookbackCheckData, this.lookbackCheckDataFileName);
    }

}


// check is executed after the minimum history input
method.check = function(candle) {

    //log.info("start check: "+tu.getDate(candle));

    this.lookbackCheckData.push(candle);

    if (this.trainingData.length < this.requiredHistory  && this.weights==null) {
        log.info("return check1");
        return this.advice();
    }

    if(this.lookbackCheckData.length < this.lookbackIndex && this.weights==null) {
        log.info("return check2");
        return this.advice();
    } else if(this.lookbackCheckData.length > this.lookbackIndex) {
        this.lookbackCheckData.shift();
    }

    if(candle.close < this.min) {
        this.min = candle.close;
    }

    if(candle.close > this.max) {
        this.max = candle.close;
    }

    var profitPercent = this.getCurrentProfitPercent(candle);

    //training failed return!
    if(!this.trained && this.open_order && profitPercent > 1){
        this.open_order = false;
        log.info("**<< Sold: $"+candle.close+" predict: "+predictValue+" predict%: "+predictPercent+" profit%: "+profitPercent);
        log.info("<< Candle date: "+tu.getDate(candle));
        this.totalProfit+=profitPercent;
        this.price=0;
        return this.advice('short');
    }

    if(!this.trained) {
        log.info("return check3");
        return this.advice();
    }

    this.lookbackCheckInput = tu.getLookbackInput(this.lookbackCheckData);
    var predictValue = this.network.activate(this.lookbackCheckInput);

    var predictNorm = tu.getNormRound(predictValue);
    var closeNorm = tu.getNorm(candle.close);
    var predictPercent = tu.getPercent(predictNorm,closeNorm);//((predictNorm-closeNorm)/closeNorm)*100;


    var isUptrendMove = tu.isUptrendMove(this.lookbackCheckInput);
    var isUptrendMoveAvg = tu.isUptrendMoveAvg(this.lookbackCheckInput);
    var isUptrendMoveAgg = isUptrendMove && isUptrendMoveAvg;
    var isDownTrend = tu.isDownTrend(this.lookbackCheckInput);

    if (this.debug) {
        log.info("input:" + this.lookbackCheckInput);

        log.info("close: " + candle.close);
        log.info("close norm: " + closeNorm);

        log.info("predict: " + predictValue);
        log.info("predict norm: " + predictNorm);
        log.info("predict%: " + predictPercent);

        log.info("isUptrend: " + isUptrendMove);
        log.info("isUptrendAvg: " + isUptrendMoveAvg);
        log.info("isUptreadAgg: " + isUptrendMoveAgg);

        log.info("past profit%: " + this.pastProfitPercent);
        log.info("profit%: " + profitPercent);
        log.info("Total Profit%: " + this.totalProfit);
    }

    if(
        !this.open_order  && !this.locked && predictPercent > 1
        && isUptrendMoveAgg //&& cs.isBullish(candle)
        && cs.isBullishHammerLike(candle)
    //&& this.isWhiteSoilders(2)
    ) {
        //log.info("Buy: $"+candle.close+" expected percent: "+percentage);
        log.info("**>> Buy: $"+candle.close+" predict: "+predictValue+" predict%: "+predictPercent);
        log.info(">> Candle date: "+tu.getDate(candle));
        //log.info(this.lookbackCheckInput);
        this.price = candle.close;
        this.pricePredictPercent = predictPercent;
        this.pastProfitPercent = profitPercent;

        this.buyDate = candle.start;
        this.buySig++;

        if(this.buySig==this.hitCounter) {
            this.buySig=0;
            this.open_order = true;
            return this.advice('long');
        } else {
            return this.advice();
        }

    } else if( this.open_order
        && ( //predictPercent < 0 ||
            !isUptrendMoveAvg && profitPercent < this.pastProfitPercent
            || (predictPercent < -this.pricePredictPercent && profitPercent < this.pastProfitPercent)
        )
    ){
        this.open_order = false;
        log.info("**<< Sold: $"+candle.close+" predict: "+predictValue+" predict%: "+predictPercent+" profit%: "+profitPercent);
        log.info("<< Candle date: "+tu.getDate(candle));
        this.totalProfit+=profitPercent;
        this.price=0;
        return this.advice('short');
    }

    this.pastProfitPercent = profitPercent;

    return this.advice();
}

method.getCurrentProfitPercent = function(candle) {
    if(this.price == 0)
        return 0;
    return ((candle.close - this.price)/this.price)*100;
}



method.log = function() {
}

module.exports = method;
