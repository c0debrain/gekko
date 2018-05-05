// npm install neataptic --save
const neataptic = require('neataptic')
const _ = require('lodash');
const config = require ('../core/util.js').getConfig();
const async = require ('async');
const log = require('../core/log.js');
const fs = require('fs');
const cs = require('../modules/candlestick.js');
const moment = require('moment');

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
    this.weightFileName = "weights/lookbackPercept-ethtrx-lab.json";
    //this.weightFileName = "weights/lookbackPercept-ethtrx-1-1-3-2500-2-10-12p.json";
    //this.weightFileName = "weights/lookbackPercept-ethtrx-3-2400-2-10-10p.json";
    //this.weightFileName = "weights/lookbackPercept-ethxrp.json";
    //this.weightFileName = "weights/staticPercept-ethxrp-13-400-2018-02-13-07-35-3p.json";
    //this.weightFileName = "weights/staticPercept.json";
    //this.weightFileName = "weights/staticPercept-11-200-338p.json";
    //this.weightFileName = "weights/staticPercept-3-400-392p.json";

    //log.debug(this.settings.weight_file);
    this.lookbackIndex = 12;//this.settings.lookback_period;
    //log.debug(this.tradingAdvisor);
    //log.debug(config);

    this.lockSell = false;

    this.roundPoint = 10;

    this.weights = null;

    this.normalizer = 1;

    this.name = '007';
    this.upCounter = 0;
    this.requiredHistory = config.tradingAdvisor.historySize;

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
    //NOTE: comment out to train and save
    //this.weights = this.readFromFile(this.weightFileName);

    //use to train
    this.lookbackData = [];
    this.trainingData = [];

    //use to activate
    this.lookbackCheckData = [];
    this.lookbackCheckInput = [];

    this.totalProfit=0;

    this.trainCount = 0;

    this.perceptOptions = {
        //dropout: 0.5,
        //clear: true,
        log: 0,
        shuffle:true,
        iterations: 80000,
        error: 0.0000000005,
        rate: 0.01,
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

    log.info("**************************************");
    if(this.weights!=null) {

      log.info("***** Creating network from file *****");
      this.network = neataptic.Network.fromJSON(this.weights);

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

    if(!this.isValidCandle(candle)) {
        return;
    }

    if(this.lookbackData.length < this.lookbackIndex) {
        this.lookbackData.push(candle);
        return;
    } else if (this.lookbackData.length > this.lookbackIndex ) {
        this.lookbackData.shift();
    }

    var myObj = {};
    myObj['input'] = this.getLookbackInput(this.lookbackData);
    //var out =  candle.close - this.lookbackData[this.lookbackData.length-1].close > 0 ? 1 : 0;
    //myObj['output'] = [out];

    //log.info("lookback candles");
    //log.info(this.lookbackData);

    //log.info("lookback input");
    //log.info(myObj['input']);

    myObj['output'] = [this.getOutput(candle)];

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

    if(this.trainingData.length >= this.requiredHistory && this.trainGap >= this.requiredHistory/2) {
    //if(this.trainingData.length >= this.requiredHistory) {
        //if(this.trainingData.length >= this.requiredHistory && !this.weights != null) {
        //if(this.trainingData.length >= this.requiredHistory && !this.open_order) {

        log.info("*************** Training DATA ***************");
        //log.info("Staring to train: "+this.trainingData.length+" count: "+ ++this.trainCount);
        //log.info(this.trainingData);
        log.info("Train end: "+getDate(candle));

        //var errorRange = this.computeTrainingErrorRage(this.trainingData);
        //log.info("Training error range: "+errorRange);

        //log.info("Start: "+this.trainingData[0].start+"End: "+this.trainingData[this.requiredHistory-1].start);
        this.network = this.getPerceptron();

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
        //this.writeToFile();
    }

}


// check is executed after the minimum history input
method.check = function(candle) {

    this.lookbackCheckData.push(candle);

    if (this.trainingData.length < this.requiredHistory  && this.weights==null) {
        return this.advice();
    }

    if(this.lookbackCheckData.length < this.lookbackIndex) {
        return this.advice();
    } else if(this.lookbackCheckData.length > this.lookbackIndex) {
        this.lookbackCheckData.shift();
    }

    this.lookbackCheckInput = this.getLookbackInput(this.lookbackCheckData);
    //log.info("Checking for lookback size: "+this.lookbackCheckInput.length);

    var predictValue = this.network.activate(this.lookbackCheckInput);
    var predictNorm = this.getNorm(predictValue);

    //log.info("predict value: "+predictValue);
    // % change in current close and predicted close
    var closeNorm = this.getNorm(candle.close);
    var predictPercent = ((predictNorm-closeNorm)/closeNorm)*100;
    //log.info("Predict%: "+predictPercent);
    //var predictPercent = predictValue;
    var profitPercent = this.getCurrentProfitPercent(candle);

    var isUptreadMove = this.isUptrendMoveAvg(this.lookbackCheckInput);

    log.info("input:"+this.lookbackCheckInput);
    log.info("close: "+candle.close);
    log.info("close norm: "+closeNorm);

    log.info("predict: "+predictValue);
    log.info("predict norm: "+predictNorm);
    log.info("predict%: "+predictPercent);
    log.info("isUptread: "+isUptreadMove);

    log.info("past profit%: "+this.pastProfitPercent);
    log.info("profit% :"+profitPercent);

    if(!this.trained){
        return this.advice();
    }

    if(
        !this.open_order  && !this.locked && predictPercent > 1
            && isUptreadMove && this.isWhiteSoilders(2)
    ) {
        //log.info("Buy: $"+candle.close+" expected percent: "+percentage);
        log.info("**>> Buy: $"+candle.close+" predict: "+predictValue+" predict%: "+predictPercent);
        log.info(">> Candle date: "+getDate(candle));
        //log.info(this.lookbackCheckInput);
        this.price = candle.close;
        this.pricePredictPercent = predictPercent;
        this.pastProfitPercent = profitPercent;
        this.open_order = true;
        this.buyDate = candle.start;
        return this.advice('long');

    } else if( this.open_order
                && ( //predictPercent < 0 ||
                        !isUptreadMove && profitPercent < this.pastProfitPercent && profitPercent > 0 ||
                        (predictPercent < -this.pricePredictPercent && profitPercent < this.pastProfitPercent)
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
        log.info("<< Candle date: "+getDate(candle));
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



method.isWhiteSoilders = function(size) {
    return this.isBullish(this.lookbackCheckData.slice(this.lookbackIndex-size,this.lookbackIndex))
}


method.buyHoursDiff = function(candle) {
    var a = moment(candle.start);
    var b = moment(this.buyDate);
    return a.diff(b,'hours');
}


method.getCurrentProfitPercent = function(candle) {
    if(this.price == 0)
        return 0;
    return ((candle.close - this.price)/this.price)*100;
}

method.isUptrendMove = function(lookbackInput) {
    return lookbackInput[lookbackInput.length-1] > lookbackInput[0];
}

method.isUptrendMoveAvg = function(lookbackInput) {
    var sum=0;
    for(var i=0;i<lookbackInput.length-1;i++) {
        sum+=lookbackInput[i];
    }
    return lookbackInput[lookbackInput.length-1] > (sum/(lookbackInput.length-1))
}

method.getLookbackInput = function(lookbackData) {
    var lookbackInput = [];
    for(var i=0;i<lookbackData.length;i++) {
        //lookbackInput.push(lookbackData[i].open * this.normalizer);
        //lookbackInput.push(lookbackData[i].high * this.normalizer);
        lookbackInput.push(this.getNorm(lookbackData[i].close));
        //lookbackInput.push(lookbackData[i].close * this.normalizer);
    }
    return lookbackInput;
}

method.getOutput = function(candle) {
    return this.getNorm(candle.close)
}

method.getNorm = function(val) {
    return round(val * this.normalizer, this.roundPoint);
}

method.isBullish = function(candles) {
    for(var i=0;i<candles.length;i++) {
        if (!cs.isBullish(candles[i])) {
            return false;
        }
    }
    return candles[candles.length-1].close > candles[0].close;
}


method.isUptrend = function(candles) {
    return candles[0].close < candles[candles.length-1].close;
}

method.isValidCandle = function(candle) {
    return !(candle.open == candle.close &&
           candle.close == candle.high &&
           candle.high == candle.low);
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



function round(value, decimals) {
    return Number(Math.round(value+'e'+decimals)+'e-'+decimals);
}

function getDate(candle) {
    return moment.utc(candle.start).format();
}

method.log = function() {
}

module.exports = method;
