sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/Device",
    "sd/deliverynoteprint/model/models"
], (UIComponent, Device, models) => {
    "use strict";

    return UIComponent.extend("sd.deliverynoteprint.Component", {
        metadata: {
            manifest: "json",

        },

        init() {
            // call the base component's init function
            UIComponent.prototype.init.apply(this, arguments);

            // set the device model
            this.setModel(models.createDeviceModel(), "device");

            // enable routing
            this.getRouter().initialize();

            // set the local model
            this.setModel(models.createLocalModel(), "local");
        }
    });
});
