/*** ControlSpcWebGateway module *******************************************
 
 Version: 1.0.0
 -----------------------------------------------------------------------------
 Author: Ola Wallin <ola.wallin@owel.se>
 Description:
 Controlls SPC alarm box through SPC Web Gateway by lundix.se
 ******************************************************************************/

function ControlSpcWebGateway(id, controller) {
    // Always call superconstructor first
    ControlSpcWebGateway.super_.call(this, id, controller);

    // Perform internal structures initialization...
}

inherits(ControlSpcWebGateway, AutomationModule);

_module = ControlSpcWebGateway;

ControlSpcWebGateway.prototype.init = function (config) {
    // Always call superclass' init first
    ControlSpcWebGateway.super_.prototype.init.call(this, config);

    this.urlPrefix = this.config.url;
    this.dT = Math.max(this.config.dT, 500); // 500 ms minimal delay between requests
    this.lastRequestD = 0;
    this.timerD = null; //Device Timer
    this.showPartAreaA = this.config.showPartAreaA;
    this.showPartAreaB = this.config.showPartAreaB;
    this.userName = this.config.userKey;
    this.userPassword = this.config.passwordKey;
    this.fullAreaTitle = this.config.fullAreaTitle;
    this.partAreaATitle = this.config.partAreaATitle;
    this.partAreaBTitle = this.config.partAreaBTitle;
    this.requestUpdateArea();
};

ControlSpcWebGateway.prototype.stop = function () {
    var self = this;

    if (this.timerD) {
        clearTimeout(this.timerD);
    }


    ControlSpcWebGateway.super_.prototype.stop.call(this);
};


// ----------------------------------------------------------------------------
// --- Module methods
// ----------------------------------------------------------------------------

ControlSpcWebGateway.prototype.requestUpdateArea = function () {
    var self = this;
    this.lastRequestD = Date.now();
    try {
        //Request data
        var request_data = {
            url: this.urlPrefix + '/spc/area',
            method: 'GET'
        };

        http.request({
            url: request_data.url,
            method: request_data.method,
            async: true,
            success: function (response) {
                self.parseResponseArea(response);
            },
            error: function (response) {
                console.log("SPC Can not make request (requestUpdate): " + response.statusText); // don't add it to notifications, since it will fill all the notifcations on error
                if (response.status === -1) {
                    console.log("SPC Retry requestUpdate");
                    self.requestUpdateArea();
                }
            },
            complete: function () {
                var dt = self.lastRequestD + self.dT - Date.now();
                if (dt < 0) {
                    dt = 1; // in 1 ms not to make recursion
                }

                if (self.timerD) {
                    clearTimeout(self.timerD);
                }

                self.timerD = setTimeout(function () {
                    self.requestUpdateArea();
                }, dt);
            }
        });
    } catch (e) {
        console.log("SPC ERROR perfoming request!");
        console.log(e.name);
        console.log(e.message);
        self.timerD = setTimeout(function () {
            self.requestUpdateArea();
        }, self.dT);
    }
};

ControlSpcWebGateway.prototype.parseResponseArea = function (response) {
    var self = this;
    if (response.status === 200) {
        var data = response.data;
       
        data.data.area.forEach(function (item) {
            var localIdFull = "SPCAreaFull_" + self.id + "_" + item.id,
                    vDevFull = self.controller.devices.get(localIdFull);
            if (self.showPartAreaA) {
	            var localIdPartA = "SPCAreaPartA_" + self.id + "_" + item.id,
	                    vDevPartA = self.controller.devices.get(localIdPartA);
	        }
	        if (self.showPartAreaB) {
	            var localIdPartB = "SPCAreaPartB_" + self.id + "_" + item.id,
	                    vDevPartB = self.controller.devices.get(localIdPartB);
	        }
            var levelFull = "off";
            var levelA = "off";
            var levelB = "off";
			var userName = "None";
            switch (parseInt(item.mode, 10)) {
            	case 0: //unset disarmed
                    levelFull = "off";
                    levelA = "off";
                    levelB = "off";
					userName = " avaktiverat av " + item.last_unset_user_name;
                    break;
                case 1: //area is part set A
                    levelFull = "off";
                    levelA = "on";
                    levelB = "off";
					userName = " aktiverat av " + item.last_set_user_name;
                    break;
                case 2: //area is part set B
                    levelFull = "off";
                    levelA = "off";
                    levelB = "on";
					userName = " aktiverat av " + item.last_set_user_name;
                    break;
                case 3: //area is full set
                	levelFull = "on";
                    levelA = "off";
                    levelB = "off";
					userName = " aktiverat av " + item.last_set_user_name;
                	break;
            }

            var deviceType = "switchBinary";
            var probeTitle = "Binary";
            var icon = "security";
            if (vDevFull) {
                    vDevFull.set("metrics:title", self.fullAreaTitle + " " + item.name + userName); //Update title     
	            if (vDevFull.get("metrics:level") !== levelFull) { //Only change if the level if different (or triggers will go haywire)
	                vDevFull.set("metrics:level", levelFull);
	            }
            } else {
                self.controller.devices.create({
                    deviceId: localIdFull,
                    defaults: {
                        deviceType: deviceType,
                        metrics: {
                            probeTitle: probeTitle,
                            level: levelFull,
                            title: self.fullAreaTitle + " " + item.name + userName,
                            icon: icon
                        }
                    },
                    overlay: {},
                    handler: function (command, args) {
                        self.handleCommandArea(this, command, args, "Full");
                    },
                    moduleId: this.id
                });
            }
            if (self.showPartAreaA) {
	            if (vDevPartA) {
	                    vDevPartA.set("metrics:title", self.partAreaATitle + " " + item.name + userName); //Update title 
		            if (vDevPartA.get("metrics:level") !== levelA) { //Only change if the level if different (or triggers will go haywire)
		                vDevPartA.set("metrics:level", levelA);
		            }
	            } else {
	                self.controller.devices.create({
	                    deviceId: localIdPartA,
	                    defaults: {
	                        deviceType: deviceType,
	                        metrics: {
	                            probeTitle: probeTitle,
	                            level: levelA,
	                            title: self.partAreaATitle + " " + item.name + userName,
	                            icon: icon
	                        }
	                    },
	                    overlay: {},
	                    handler: function (command, args) {
	                        self.handleCommandArea(this, command, args, "A");
	                    },
	                    moduleId: this.id
	                });
	            }
	        }
	        if (self.showPartAreaB) {
	            if (vDevPartB) {
	                    vDevPartB.set("metrics:title", self.partAreaBTitle + " " + item.name  + userName); //Update title
		            if (vDevPartB.get("metrics:level") !== levelB) { //Only change if the level if different (or triggers will go haywire)
		                vDevPartB.set("metrics:level", levelB);
		            }
	            } else {
	                self.controller.devices.create({
	                    deviceId: localIdPartB,
	                    defaults: {
	                        deviceType: deviceType,
	                        metrics: {
	                            probeTitle: probeTitle,
	                            level: levelB,
	                            title: self.partAreaBTitle + " " + item.name + userName,
	                            icon: icon
	                        }
	                    },
	                    overlay: {},
	                    handler: function (command, args) {
	                        self.handleCommandArea(this, command, args, "B");
	                    },
	                    moduleId: this.id
	                });
	            }
	        }
        });
    }
};

ControlSpcWebGateway.prototype.handleCommandArea = function (vDev, command, args, part) {
    var self = this;
    var remoteId;
    if (part === "Full"){
    	remoteId = vDev.id.slice(("SPCAreaFull_" + this.id + "_").length);
    } else if (part === "A"){
    	remoteId = vDev.id.slice(("SPCAreaPartA_" + this.id + "_").length);
    } else if (part === "B"){
    	remoteId = vDev.id.slice(("SPCAreaPartB_" + this.id + "_").length);
    }
    
    var level = command;
    var url = "";
    switch (command) {
        /*case "update":
            remoteId = remoteId.slice(0, -1);
            if (part === "Full"){
            	url = this.urlPrefix + '/spc/area/' + remoteId + '/set';
            } else if (part === "A"){
            	url = this.urlPrefix + '/spc/area/' + remoteId + '/set_a';
            } else if (part === "B"){
            	url = this.urlPrefix + '/spc/area/' + remoteId + '/set_a';
            }
            break;*/
        case "on":
            if (part === "Full"){
            	url = this.urlPrefix + '/spc/area/' + remoteId + '/set';
            } else if (part === "A"){
            	url = this.urlPrefix + '/spc/area/' + remoteId + '/set_a';
            } else if (part === "B"){
            	url = this.urlPrefix + '/spc/area/' + remoteId + '/set_a';
            }
            break;
        case "off":
            url = this.urlPrefix + '/spc/area/' + remoteId + '/unset';
            break;
        case "exact":
            break;
        default:
            return;
    }

    try {
        //Request data
        var request_data = {
            url: url,
            method: 'PUT'
        };

        http.request({
            url: request_data.url,
            method: request_data.method,
            async: true,
            success: function (response) {
                if (response.status === 200) {
                    var data = response.data;
                    console.log(data.id);
                    console.log(remoteId);
                    //Device response
                    if (data.status !== undefined && data.status === "success") {
                        vDev.set("metrics:level", level);
                    
                    } else {
                        console.log("Unknown or error response (handleDeviceCommand)");
                    }
                }
            },
            error: function (response) {
                console.log("Can not make request (handleCommand): " + response.statusText);
                if (response.status === -1) {
                    console.log("Retry handleDeviceCommand");
                    self.handleCommandArea(vDev, command, args);
                }
            },
            complete: function () {
            }
        });
    } catch (e) {
        console.log("ERROR perfoming request!");
    }
    
};




