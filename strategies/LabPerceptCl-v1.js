// npm install neataptic --save
const neataptic = require('neataptic')
const _ = require('lodash');
const config = require ('../core/util.js').getConfig();
const async = require ('async');
const log = require('../core/log.js');

const cs = require('../modules/candlestick.js');
const tu = require('../modules/tradeutil.js');
const ts = require("timeseries-analysis");


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

    this.weightFileName = "weights/boot-perceptcl-ethtrx.json";
    this.trainDataFileName = "weights/train-boot-data-ethxrp.json";
    this.trainDataLookbackFileName = "weights/train-lookback-boot-data-ethxrp.json";
    this.predictDataFileName = "weights/predict-boot-data-ethxrp.json";

    //this.weightFileName = "weights/lookbackPercept-ethtrx-1-1-3-2500-2-10-12p.json";
    //this.weightFileName = "weights/lookbackPercept-ethtrx-3-2400-2-10-10p.json";
    //this.weightFileName = "weights/lookbackPercept-ethxrp.json";
    //this.weightFileName = "weights/staticPercept-ethxrp-13-400-2018-02-13-07-35-3p.json";
    //this.weightFileName = "weights/staticPercept.json";
    //this.weightFileName = "weights/staticPercept-11-200-338p.json";
    //this.weightFileName = "weights/staticPercept-3-400-392p.json";

    //log.debug(this.settings.weight_file);
    this.lookbackIndex = 24;//this.settings.lookback_period;
    //log.debug(this.tradingAdvisor);
    //log.debug(config);

    this.lockSell = false;

    this.roundPoint = 10;

    this.weights = null;
    this.trainSave = false;

    this.normalizer = 1;

    this.name = '007';
    this.upCounter = 0;
    this.requiredHistory = config.tradingAdvisor.historySize;
    this.trainPeriod = this.requiredHistory/6;

    log.info("minimum history: "+this.requiredHistory);

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

    this.trainCount = 0;

    this.buySig = 0;

    this.perceptOptions = {
        dropout: 0.5,
        clear: true,
        log: 0,
        shuffle:false,
        iterations: 80000,
        error: 0.00000003,
        rate: 0.001,
    };

    this.getPerceptron = function() {
        return new neataptic.architect.Perceptron(
            1*this.lookbackIndex,4, 1
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

      this.lookbackData = tu.readJsonFromFile(this.trainDataLookbackFileName);
      this.trainingData = tu.readJsonFromFile(this.trainDataFileName);
      this.lookbackCheckData = tu.readJsonFromFile(this.predictDataFileName);

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

    if(this.trainingData.length >= this.requiredHistory && this.trainGap >= this.trainPeriod) {
    //if(this.trainingData.length >= this.requiredHistory) {
        //if(this.trainingData.length >= this.requiredHistory && !this.weights != null) {
        //if(this.trainingData.length >= this.requiredHistory && !this.open_order) {

        log.info("*************** Training DATA ***************");
        //log.info("Staring to train: "+this.trainingData.length+" count: "+ ++this.trainCount);
        //log.info(this.trainingData);
        log.info("Train end: "+tu.getDate(candle));

        //var errorRange = this.computeTrainingErrorRage(this.trainingData);
        //log.info("Training error range: "+errorRange);

        //log.info("Start: "+this.trainingData[0].start+"End: "+this.trainingData[this.requiredHistory-1].start);

        this.network = this.getPerceptron();

        //this.network = new neataptic.architect.LSTM(4,16,1);
        // this.network = new neataptic.Network(4*this.lookbackIndex, 1);
        //this.network = new neataptic.architect.NARX(1*this.lookbackIndex,4, 1, 10, 10);

        //evolve
        // this.network = new neataptic.Network(4*this.lookbackIndex, 1);

        //log.info(this.trainingData);

        //perceptron
        var result = this.network.train(this.trainingData, this.perceptOptions);

        log.info("Training done with iteration: "+result.iterations);
        this.trained = result.iterations < this.perceptOptions.iterations ? true : false;
        this.trainGap = 0;

        //evolve
        //(async ()=>{
          //  await this.network.evolve(this.trainingData, this.evolveOptions);
        //})();

        //log.info("Done training .. writing weights to file:");
        if(this.trainSave) {
            tu.writeJsonToFile(this.network.toJSON(), this.weightFileName);
        }
    } else if(this.trainSave){
        //we loaded network from file
        this.trained = true;
    }

    if(this.trainSave) {
        tu.writeJsonToFile(this.lookbackCheckInput, this.trainDataLookbackFileName);
        tu.writeJsonToFile(this.trainingData, this.trainDataFileName);
        tu.writeJsonToFile(this.lookbackCheckData, this.predictDataFileName);
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

    var predictNorm = tu.getNorm(predictValue);
    var closeNorm = tu.getNorm(candle.close);
    var predictPercent = tu.getPercent(predictNorm,closeNorm);//((predictNorm-closeNorm)/closeNorm)*100;


    var isUptrendMove = tu.isUptrendMove(this.lookbackCheckInput);
    var isUptrendMoveAvg = tu.isUptrendMoveAvg(this.lookbackCheckInput);
    var isUptrendMoveAgg = isUptrendMove && isUptrendMoveAvg;
    var isDownTrend = tu.isDownTrend(this.lookbackCheckInput);

    // timeseries processing

    // Data out of MongoDB:
    var data = this.lookbackCheckInput;
    // Load the data
    var t = new ts.main(ts.adapter.fromArray(data));
    var chart_url = t.ma({period: 24}).chart();

    var stdev = t.stdev();

    log.info("input:"+this.lookbackCheckInput);
    //log.info("chart url: "+chart_url);

    log.info("close: "+candle.close);
    log.info("close norm: "+closeNorm);

    log.info("predict: "+predictValue);
    log.info("predict norm: "+predictNorm);
    log.info("predict%: "+predictPercent);

    log.info("STD: "+ stdev);

    log.info("isUptrend: "+isUptrendMove);
    log.info("isUptrendAvg: "+isUptrendMoveAvg);
    log.info("isUptreadAgg: "+isUptrendMoveAgg);

    log.info("past profit%: "+this.pastProfitPercent);
    log.info("profit%: "+profitPercent);

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

        if(this.buySig==3) {
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
            //&& ((profitPercent >= this.pricePredictPercent && profitPercent < this.pastProfitPercent))
              //  || profitPercent > 0 && profitPercent < this.pastProfitPercent)
            //&& (predictPercent < 0 || (profitPercent > 1.3 && profitPercent < this.pastProfitPercent))
             //&& (predictPercent < -this.pricePredictPercent && profitPercent < this.pastProfitPercent)
                ///(profitPercent > 1 && profitPercent < this.pastProfitPercent)
            //|| (profitPercent < 0 && profitPercent > this.pastProfitPercent * 2)
            //|| (predictPercent > profitPercent && profitPercent < -1)
            //actual profit is dropping
            //(profitPercent < this.pastProfitPercent && profitPercent > 1.5))
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
