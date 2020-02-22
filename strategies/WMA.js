var method = {};

method.init = function() {
  this.name = 'weighted Moving Average';
  this.trend = 'short'
  this.requiredHistory = this.settings.long;

  this.addIndicator('short', 'SMA', this.settings.short)
  this.addIndicator('medium','SMA', this.settings.medium)
  this.addIndicator('long', 'SMA', this.settings.long)
}

method.update = function(candle) {
  this.indicators.short.update(candle.close)
  this.indicators.medium.update(candle.close)
  this.indicators.long.update(candle.close)
}

method.check = function() {
  const short = this.indicators.short.result;
  const medium = this.indicators.medium.result;
  const long = this.indicators.long.result;

  if((short > medium) && (medium > long) && this.trend === 'short') {
    this.trend = 'long'
    this.advice('long')
  } else if((short < medium) && (medium > long) && this.trend == 'long') {
    this.trend = 'short'
    this.advice('short')
  } else if(((short > medium) && (medium < long)) && this.trend === 'long') {
    this.trend = 'short'
    this.advice('short')
  } else {
    this.advice();
  }
}

module.exports = method;
