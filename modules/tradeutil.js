
const fs = require('fs');
const moment = require('moment');
const log = require('../core/log.js');

var tradeutil={
    normalizer:1,
    roundPoint:9
};

tradeutil.getPercent = function(p1, p2) {
    return ((p1 - p2)/p2)*100;
}


tradeutil.isTotalUptrend = function(lookbackInput) {
    for(var i=0;i<lookbackInput.length-2;i++) {
        if(lookbackInput[i] > lookbackInput[i+1]) {
            return false;
        }
    }
    return true;
}

tradeutil.isUptrendMove = function(lookbackInput) {
    return lookbackInput[lookbackInput.length-1] > lookbackInput[0];
}

tradeutil.isDownTrend = function(lookbackInput) {
    return lookbackInput[lookbackInput.length-1] < lookbackInput[lookbackInput.length-4];
}

tradeutil.isUptrendMoveAvg = function(lookbackInput) {
    var sum=0;
    for(var i=0;i<lookbackInput.length-1;i++) {
        sum+=lookbackInput[i];
    }
    return lookbackInput[lookbackInput.length-1] > (sum/(lookbackInput.length-1))
}

tradeutil.getLookbackInput = function(lookbackData) {
    var lookbackInput = [];
    for(var i=0;i<lookbackData.length;i++) {
        //lookbackInput.push(lookbackData[i].open * this.normalizer);
        //lookbackInput.push(lookbackData[i].high * this.normalizer);
        lookbackInput.push(this.getNorm(lookbackData[i].close));
        //lookbackInput.push(lookbackData[i].close * this.normalizer);
    }
    return lookbackInput;
}

tradeutil.getOutput = function(candle) {
    return this.getNorm(candle.close)
}

tradeutil.getNorm = function(val) {
    return this.round(val * this.normalizer, this.roundPoint);
}

tradeutil.getNormRound = function(val) {
    return this.round(val,this.roundPoint);
}

tradeutil.round = function(value, decimals) {
    return Number(Math.round(value+'e'+decimals)+'e-'+decimals);
}

tradeutil.getDate = function(candle) {
    return moment.utc(candle.start).format();
}

tradeutil.getDayOfMonth = function(candle) {
    return moment.utc(candle.start).format("D");
}

tradeutil.getHourOfDay = function(candle) {
    return moment.utc(candle.start).format("H");
}

tradeutil.getMinuteOfHour = function(candle) {
    return moment.utc(candle.start).format("m");
}

tradeutil.getMonthOfYear = function(candle) {
    return moment.utc(candle.start).format("M");
}

tradeutil.getCSVCandle = function(candle) {
    var csvCandle = {}
    csvCandle.start = this.getHourOfDay(candle)
    csvCandle.open = candle.open
    csvCandle.high = candle.high
    csvCandle.low = candle.low
    csvCandle.close = candle.close
    csvCandle.vwp = candle.vwp
    csvCandle.volume = candle.volume
    csvCandle.trades = candle.trades
    return csvCandle
}

tradeutil.getLabeldCandle = function(candle) {
    var csvCandle = {}
    csvCandle.label = 0;
    csvCandle.month = this.getMonthOfYear(candle)
    csvCandle.day = this.getDayOfMonth(candle)
    csvCandle.start = this.getHourOfDay(candle)
    csvCandle.minute = this.getMinuteOfHour(candle)
    csvCandle.open = candle.open
    csvCandle.high = candle.high
    csvCandle.low = candle.low
    csvCandle.close = candle.close
    csvCandle.vwp = candle.vwp
    csvCandle.volume = candle.volume
    csvCandle.trades = candle.trades
    return csvCandle
}

tradeutil.getLabeldCandleFloat32Array = function(candle) {
    var csvCandle = new Float32Array(11)
    csvCandle[0] = this.getMonthOfYear(candle)
    csvCandle[1] = this.getDayOfMonth(candle)
    csvCandle[2] = this.getHourOfDay(candle)
    csvCandle[3] = this.getMinuteOfHour(candle)
    csvCandle[4] = candle.open
    csvCandle[5] = candle.high
    csvCandle[6] = candle.low
    csvCandle[7] = candle.close
    csvCandle[8] = candle.vwp
    csvCandle[9] = candle.volume
    csvCandle[10] = candle.trades
    return csvCandle
}

tradeutil.isValidCandle = function(candle) {
    return !(candle.open == candle.close &&
    candle.close == candle.high &&
    candle.high == candle.low);
}

tradeutil.writeJsonToFile = function(exported, weightFileName) {
    //const exported = network.toJSON();
    const content = JSON.stringify(exported);
    fs.writeFile(weightFileName, content, function(err, data){
        if (err) console.log(err);
    });
}

tradeutil.readJsonFromFile = function(filePath) {
    try {
        var data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch(err) {
        log.warn("No file found");
        return null;
    }
}


tradeutil.writeToFile = function(content, fileName) {
    //const exported = network.toJSON();
    //const content = JSON.stringify(exported);
    fs.writeFile(fileName, content, function(err, data){
        if (err) console.log(err);
    });
}

tradeutil.convertArrayOfObjectsToCSV = function(args) {
    var result, ctr, keys, columnDelimiter, lineDelimiter, data;

    data = args.data || null;
    if (data == null || !data.length) {
        return null;
    }

    columnDelimiter = args.columnDelimiter || ',';
    lineDelimiter = args.lineDelimiter || '\n';

    keys = Object.keys(data[0]);

    result = '';
    result += keys.join(columnDelimiter);
    result += lineDelimiter;

    data.forEach(function(item) {
        ctr = 0;
        keys.forEach(function(key) {
            if (ctr > 0) result += columnDelimiter;

            result += item[key];
            ctr++;
        });
        result += lineDelimiter;
    });

    return result;
}

module.exports = tradeutil;