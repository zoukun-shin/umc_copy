sap.ui.define([
    "sap/ui/core/UIComponent",
    "pp/zprodordercomppr/model/models"
], (UIComponent, models) => {
    "use strict";

    return UIComponent.extend("pp.zprodordercomppr.Component", {
        metadata: {
            manifest: "json",
            interfaces: [
                "sap.ui.core.IAsyncContentCreation"
            ]
        },

        init() {
            // call the base component's init function
            UIComponent.prototype.init.apply(this, arguments);

            // enable routing
            this.getRouter().initialize();

            // set the device model
            this.setModel(models.createDeviceModel(), "device");

            // set the local model
            this.setModel(models.createLocalModel(), "local");
        }
    });
});