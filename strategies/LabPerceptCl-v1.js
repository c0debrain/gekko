// npm install neataptic --save
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

    this.weightFileName = "weights/bp/boot-perceptcl-weight-ethtrx.json";
    this.lookbackDataFileName = "weights/bp/boot-lookback-data-ethxrp.json";
    this.trainDataFileName = "weights/bp/boot-train-data-ethxrp.json";
    this.lookbackCheckDataFileName = "weights/bp/boot-lookback-check-data-ethxrp.json";

    this.lockSell = false;


    this.name = '007';
    this.upCounter = 0;

    this.trainGap=0;
    this.trained = false;

    this.price = 0;
    this.pricePredictPercent = 0;
    //history
    this.pastProfitPercent = 0;

    this.open_order = false;
    this.locked = false;

    this.network=null;

    //use to train
    this.lookbackData = [];
    this.trainingData = [];

    //use to activate
    this.lookbackCheckData = [];
    this.lookbackCheckInput = [];

    this.totalProfit=0;

    this.buySig = 0;
    this.hitCounter = 5;

    this.trainSave = false;
    this.weights = null;

    this.shift = true;
    this.lookbackIndex = 24;//this.settings.lookback_period;
    this.requiredHistory = config.tradingAdvisor.historySize;

    this.trainPeriod = this.requiredHistory/3;

    log.info("minimum history: "+this.requiredHistory);

    tu.normalizer = 100;
    tu.roundPoint = 7;

    this.perceptOptions = {
        clear: true,
        log: 20000,
        shuffle:false,
        iterations: 500000,
        error: 0.00005,
        rate: 0.000005,
        momentum: 0.9,
        batchSize:  this.requiredHistory
    };

    this.getPerceptron = function() {
        return new neataptic.architect.Perceptron(
            1*this.lookbackIndex,2,1
        );
    };

    this.evolveOptions = {
        mutation: neataptic.methods.mutation.FFW,
        equal: true,
        popsize: 1000,
        elitism: 100,
        log: 1000,
        error: 0.00001,
        iterations: 10000,
        mutationRate: 0.001
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
    log.info("start update: "+tu.getDate(candle));

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
        this.weights = null;
        log.info("*************** Training DATA ***************");
        log.info("Train data size: "+this.trainingData.length);
        log.info("Train end: "+tu.getDate(candle));
        log.info("Train Gap: "+this.trainGap);

        this.network = this.getPerceptron();

        //perceptron
        this.perceptOptions.batchSize = this.trainingData.length;
        var result = this.network.train(this.trainingData, this.perceptOptions);

        log.info("Training done with iteration: "+result.iterations);
        this.trained = result.iterations < this.perceptOptions.iterations ? true : false;
        this.trainGap = 0;
        log.info("Trained: "+this.trained);
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

    log.info("start check: "+tu.getDate(candle));

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

    log.info("input:"+this.lookbackCheckInput);

    log.info("close: "+candle.close);
    log.info("close norm: "+closeNorm);

    log.info("predict: "+predictValue);
    log.info("predict norm: "+predictNorm);
    log.info("predict%: "+predictPercent);

    log.info("isUptrend: "+isUptrendMove);
    log.info("isUptrendAvg: "+isUptrendMoveAvg);
    log.info("isUptreadAgg: "+isUptrendMoveAgg);

    log.info("past profit%: "+this.pastProfitPercent);
    log.info("profit%: "+profitPercent);
    log.info("Total Profit%: "+this.totalProfit);

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

    //sell and lock account
    } else if (this.open_order  && this.lockSell
            && (this.buyHoursDiff(candle) > 7 && profitPercent < 0.5 && profitPercent < this.pastProfitPercent))
    {
        this.open_order = false;
        //this.locked = true;
        log.info("**<<! Lock Sold: $"+candle.close+" predict: "+predictValue+" predict%: "+predictPercent+" profit%: "+profitPercent);
        this.locked = true;
        return this.advice('short');
    //unlock
    } else if(this.locked
            && ((predictPercent < 0)
            )
        ) {
        log.info("**!! Unlock: "+candle.close+" predict: "+predictValue+" predict%: "+predictPercent);
        this.locked = false;
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
