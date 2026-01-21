sap.ui.define([
    "sap/ui/core/UIComponent",
    "sd/printpackinglist/model/models"
], (UIComponent, models) => {
    "use strict";

    return UIComponent.extend("sd.printpackinglist.Component", {
        metadata: {
            manifest: "json",
            interfaces: [
                "sap.ui.core.IAsyncContentCreation"
            ]
        },

        init() {
            // call the base component's init function
            UIComponent.prototype.init.apply(this, arguments);

            // set the device model
            this.setModel(models.createDeviceModel(), "device");

            // set the local model
            this.setModel(models.createLocalModel(), "local");

            // enable routing
            this.getRouter().initialize();
        }
    });
});