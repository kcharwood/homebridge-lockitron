var request = require("request");
var express = require('express')
var bodyParser = require('body-parser');
var Service, Characteristic;

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;

  homebridge.registerAccessory("homebridge-lockitron", "Lockitron", LockitronAccessory);
}

function LockitronAccessory(log, config) {
  this.log = log;
  this.name = config["name"];
  this.accessToken = config["api_token"];
  this.lockID = config["lock_id"];
  this.interval = config["interval"] || 600
  this.webhookPort = config["webhook_port"]
  this.webhookEndpoint = config["webhook_endpoint"] || '/lockitron'
  
  this.lockService = new Service.LockMechanism(this.name);
  
  this.lockService
    .getCharacteristic(Characteristic.LockCurrentState)
    .on('get', this.getState.bind(this));
  
  this.lockService
    .getCharacteristic(Characteristic.LockTargetState)
    .on('get', this.getState.bind(this))
    .on('set', this.setState.bind(this));
	
  this.batteryService = new Service.BatteryService();
  this.batteryService.setCharacteristic(Characteristic.Name, "Battery Level");
	
  if (this.webhookPort) {
	  this.log.warn('Lockitron will use webhooks for updates. This is an advanced feature, and requires ensuring the webhooks can be received remotely. Please consult the README for more details.')
  	  this.server = express();
  	  this.server.use(bodyParser.json());

  	  this.server.post(this.webhookEndpoint, (function (req, res) {
		var that = this
  	  	that.log.debug(req.body)
  	  	that.log.debug(req.headers)

  	  	// TODO Validate Signature

  	  	activity = req.body.data.activity
  		that.log('Recevied webhook for ' + activity.kind + ' activity');
  	  	// Handle Lock Event
  	  	if (activity.kind == 'lock-updated-locked') {
  	  	  that.log("Door has been locked");
  		  that.lockService.setCharacteristic(Characteristic.LockCurrentState, Characteristic.LockCurrentState.SECURED);
  	  	}
  	  	// Handle Unlock Event
  	  	else if (activity.kind == 'lock-updated-unlocked') {
  	  	  that.log("Door has been unlocked")
  		  that.lockService.setCharacteristic(Characteristic.LockCurrentState, Characteristic.LockCurrentState.UNSECURED);
  	  	} else {
  	  		that.log.debug("This webhook event was not handled")
  	  	}

  	  	res.status(204).send('')
  	  }).bind(this))

  	  
  	  this.server.listen(this.webhookPort, () => this.log('Lockitron webhooks now listening on :' + this.webhookPort + this.webhookEndpoint + '.\nPlease ensure this port is accessable to the outside world, and your app has been properly configured in your Lockitron Developer Dashboard!'))
  }

  this.updateState()
}

LockitronAccessory.prototype.updateState = function() {
	var that = this
	that.log.debug("Polling Lockitron State")
    request.get({
      url: "https://api.lockitron.com/v2/locks/"+this.lockID,
      qs: { access_token: this.accessToken }
    }, function(err, response, body) {
    
      if (!err && response.statusCode == 200) {
		
        var json = JSON.parse(body);
        var state = json.state; // "lock" or "unlock"
		
		// Update Lock
		if (that.webhookPort == null) {
	      var locked =(state == "lock") ? Characteristic.LockCurrentState.SECURED : Characteristic.LockCurrentState.UNSECURED;
		  that.log.debug("Lock State: " + state)
          that.lockService.setCharacteristic(Characteristic.LockCurrentState, locked);			
		} else {
		  that.log.debug("Webhooks enabled. Skipping lock update.")
		}

		
		// Update Battery Level
		battery_level = json.battery_percentage
		that.batteryService.setCharacteristic(Characteristic.BatteryLevel, battery_level);
		that.log.debug("Battery Level: " + battery_level)
		that.batteryService.setCharacteristic(Characteristic.StatusLowBattery, (battery_level > 10) ? 0 : 1);
		
      }
      else {
        that.log.error("Error polling (status code %s): %s", response.statusCode, err);
      }
	}.bind(this));
	setTimeout(this.updateState.bind(this), this.interval * 1000);
}

LockitronAccessory.prototype.getState = function(callback) {
  this.log("Getting current state...");
  
  request.get({
    url: "https://api.lockitron.com/v2/locks/"+this.lockID,
    qs: { access_token: this.accessToken }
  }, function(err, response, body) {
    
    if (!err && response.statusCode == 200) {
      var json = JSON.parse(body);
      var state = json.state; // "lock" or "unlock"
      this.log("Lock state is %s", state);
      var locked =(state == "lock") ? Characteristic.LockCurrentState.SECURED : Characteristic.LockCurrentState.UNSECURED;
      callback(null, locked); // success
    }
    else {
      this.log.error("Error getting state (status code %s): %s", response.statusCode, err);
      callback(err);
    }
  }.bind(this));
}
  
LockitronAccessory.prototype.setState = function(state, callback) {
  var lockitronState = (state == Characteristic.LockTargetState.SECURED) ? "lock" : "unlock";

  this.log("Set state to %s", lockitronState);

  request.put({
    url: "https://api.lockitron.com/v2/locks/"+this.lockID,
    qs: { access_token: this.accessToken, state: lockitronState }
  }, function(err, response, body) {

    if (!err && response.statusCode == 200) {
      this.log("State change complete.");
      
      // we succeeded, so update the "current" state as well
      var currentState = (state == Characteristic.LockTargetState.SECURED) ?
        Characteristic.LockCurrentState.SECURED : Characteristic.LockCurrentState.UNSECURED;
      
      this.lockService
        .setCharacteristic(Characteristic.LockCurrentState, currentState);
      
      callback(null); // success
    }
    else {
      this.log.error("Error '%s' setting lock state. Response: %s", err, body);
      callback(err || new Error("Error setting lock state."));
    }
  }.bind(this));
},

LockitronAccessory.prototype.getServices = function() {
  return [this.lockService, this.batteryService];
}
