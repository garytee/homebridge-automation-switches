'use strict';

// const clone = require('clone');

let Accessory, Characteristic, Service;



const ssh = require("@garytee/ssh-exec");
const assign = require("object-assign");

class SwitchAccessory {

  constructor(api, log, config, storage) {
    Accessory = api.hap.Accessory;
    Characteristic = api.hap.Characteristic;
    Service = api.hap.Service;

    // this.log = log;
    // this.name = config.name;
    // this._config = config;

      this.log = log;
      this.service = "Switch";

      this.name = config["name"];
      this.onCommand = config["on"];
      this.offCommand = config["off"];
      this.stateCommand = config["state"];
      this.onValue = config["on_value"] || "playing";
      this.onValue = this.onValue.trim().toLowerCase();
      this.exactMatch = config["exact_match"] || true;
      this.ssh = assign(
        {
          user: config["user"],
          host: config["host"],
          password: config["password"],
          key: config["key"],
        },
        config["ssh"]
      );

    this._storage = storage;

    const defaultValue = {
      state: config.default === undefined ? false : config.default
    };

    storage.retrieve(defaultValue, (error, value) => {
      this._state = value;
    });

    this._services = this.createServices();
  }

  getServices() {
    return this._services;
  }

  createServices() {
    return [
      this.getAccessoryInformationService(),
      this.getBridgingStateService(),
      this.getSwitchService()
    ];
  }

  getAccessoryInformationService() {
    return new Service.AccessoryInformation()
      .setCharacteristic(Characteristic.Name, this.name)
      .setCharacteristic(Characteristic.Manufacturer, 'Michael Froehlich')
      .setCharacteristic(Characteristic.Model, 'Switch')
      .setCharacteristic(Characteristic.SerialNumber, this._config.serialNumber)
      .setCharacteristic(Characteristic.FirmwareRevision, this._config.version)
      .setCharacteristic(Characteristic.HardwareRevision, this._config.version);
  }

  getBridgingStateService() {
    return new Service.BridgingState()
      .setCharacteristic(Characteristic.Reachable, true)
      .setCharacteristic(Characteristic.LinkQuality, 4)
      .setCharacteristic(Characteristic.AccessoryIdentifier, this.name)
      .setCharacteristic(Characteristic.Category, Accessory.Categories.SWITCH);
  }

  getSwitchService() {
    this._switchService = new Service.Switch(this.name);
    this._switchService.getCharacteristic(Characteristic.On)
      .on('set', this._setState.bind(this))
      .updateValue(this._state.state);

    this._switchService.isPrimaryService = true;

    return this._switchService;
  }

  identify(callback) {
    this.log(`Identify requested on ${this.name}`);
    callback();
  }

  _setState(value, callback) {

      var accessory = this;
      var state = powerOn ? "on" : "off";
      var prop = state + "Command";
      var command = accessory[prop];

      var stream = ssh(command, accessory.ssh);


    this.log(`Change target state of ${this.name} to ${value}`);

    const data = clone(this._state);
    data.state = value;


      stream.on("error", function (err) {
        accessory.log("Error: " + err);
        callback(
          err || new Error("Error setting " + accessory.name + " to " + state)
        );
      });

      stream.on("finish", function () {
        accessory.log("Set " + accessory.name + " to " + state);
        callback(null);
      });

    this._persist(data, callback);
  }

  _persist(data, callback) {
    this._storage.store(data, (error) => {
      if (error) {
        callback(error);
        return;
      }

      this._state = data;
      callback();
    });
  }
}

module.exports = SwitchAccessory;
