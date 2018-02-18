// npm install neataptic --save
const neataptic = require('neataptic')
const _ = require('lodash');
const config = require ('../core/util.js').getConfig();
const async = require ('async');
const log = require('../core/log.js');
const fs = require('fs');

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
    this.weightFileName = "weights/staticPercept.json";
    //this.weightFileName = "weights/staticPercept-11-200-338p.json";
    //this.weightFileName = "weights/staticPercept-3-400-392p.json";

    this.weights = null;

    this.normalizer = 10;
    this.name = '007';
    this.requiredHistory = config.tradingAdvisor.historySize;

    log.info("minimum history: "+this.requiredHistory);
    this.price = 0;
    this.open_order = false;

    this.network=null;
    //NOTE: comment out to train and save
    //this.weights = this.readFromFile(this.weightFileName);

    log.info("**************************************");
    if(this.weights!=null) {
      log.info("***** Creating network from file *****");
      this.network = neataptic.Network.fromJSON(this.weights);
    } else {
      // preprate neural network
      log.info("*** Training network from scratch ****");
      this.network = new neataptic.architect.Perceptron(4,3,1);
      //this.network = new neataptic.architect.LSTM(4,16,1);
    }
      log.info("***************************************");

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

    if(this.weights!=null) {
      return;
    }

    this.obj['input'] = [this.previousCandle.open,this.previousCandle.close,
                        this.previousCandle.high,this.previousCandle.low]; // no normalizer
    this.obj['output'] = [candle.close];
    this.previousCandle = candle;



    if(this.trainingData.length > this.requiredHistory) {
        //log.info("trainDataSize size: "+this.trainingData.length);
        //this.trainingData.shift();
        return;
    }

    // train the neural network
    log.info("pushing training data:");
    log.info(this.obj);

    this.trainingData.push(this.obj);
    //log.info("Pushing train data "+this.trainCounter++);

    //log.info("update called: trainDataSize: "+this.trainingData.length);

    if(this.trainingData.length == this.requiredHistory+1 && !this.weights != null) {
      log.info("Staring to train: "+this.trainingData.length);
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

      this.writeToFile();
  }

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
    /*

    fs.stat(filePath, function(err, stat) {
      if(err == null) {
        fs.readFile(filePath, function read(err, data) {
          if (err) {
              log.error("ERROR reading weight file");
              throw err;
          }
          log.info("Read weights from file");
          log.info(data);
          jsonData = JSON.parse(data);
          log.info(jsonData);
        });
      } else if(err.code == 'ENOENT') {
          // file does not exist
          log.error("Network file dont exist")
          //fs.writeFile('log.txt', 'Some log\n');
      } else {
          console.log('Some other error: ', err.code);
      }
  });
  return jsonData;
  */
}


method.log = function() {

}

// check is executed after the minimum history input
method.check = function(candle) {

    if (this.trainingData.length < this.requiredHistory+1) {
        return;
    }

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
    var predicted_value = this.network.activate([candle.open,candle.close,candle.high,candle.low]);

    // % change in current close and predicted close
    var percentage = ((predicted_value-candle.close)/candle.close)*100;

    //log.info("=========================================");
    //log.info("Checking for candle: "+candle.start+" Close: "+candle.close);
    //log.info("Predicted value: "+predicted_value);
    //log.info("Percent: "+percentage);

    if(percentage > 1 && !this.open_order)
    {
        log.info("Buy: $"+candle.close+" expected percent: "+percentage);
        //this.price = candle.close;
        this.open_order = true;
        return this.advice('long');

    } else if(this.open_order && percentage < 0){
        this.open_order = false;
        log.info("Sold: $"+candle.close+" expected percent: "+percentage);
        return this.advice('short');
    }

    return this.advice();
}

module.exports = method;
