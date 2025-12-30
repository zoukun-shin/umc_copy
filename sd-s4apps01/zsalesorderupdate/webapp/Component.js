sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/Device",
    "sd/zsalesorderupdate/model/models"
], (UIComponent, Device, models) => {
    "use strict";

    return UIComponent.extend("sd.zsalesorderupdate.Component", {
        metadata: {
            manifest: "json"
        },

        init() {
            // call the base component's init function
            UIComponent.prototype.init.apply(this, arguments);

            // enable routing
            this.getRouter().initialize();

            // set the local model
            this.setModel(models.createLocalModel(), "local");

            // set the device model
            this.setModel(models.createDeviceModel(), "device");
        }
    });
});