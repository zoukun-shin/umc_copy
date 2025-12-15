sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/Device",
    "pp/fglabel/model/models"
], (UIComponent, Device, models) => {
    "use strict";

    return UIComponent.extend("pp.fglabel.Component", {
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
