sap.ui.define([
    "sap/ui/core/UIComponent",
    "sd/achievementrate/model/models"
], function(UIComponent, models) {
    "use strict";
    return UIComponent.extend("sd.achievementrate.Component", {
        metadata: {
            manifest: "json",
            interfaces: [
                "sap.ui.core.IAsyncContentCreation"
            ]
        },
        init() {
            UIComponent.prototype.init.apply(this, arguments);
            this.setModel(models.createDeviceModel(), "device");
            this.getRouter().initialize();
        }
    });
});
