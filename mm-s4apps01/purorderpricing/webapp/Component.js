sap.ui.define([
    "sap/ui/core/UIComponent",
    "mm/purorderpricing/model/models"
], (UIComponent, models) => {
    "use strict";

    return UIComponent.extend("mm.purorderpricing.Component", {
        metadata: {
            manifest: "json",
            interfaces: [
                "sap.ui.core.IAsyncContentCreation"
            ]
        },

        init() {
            UIComponent.prototype.init.apply(this, arguments);

            this.setModel(models.createDeviceModel(), "device");
            this.setModel(models.createLocalModel(), "local");

            this.getRouter().initialize();
        }
    });
});