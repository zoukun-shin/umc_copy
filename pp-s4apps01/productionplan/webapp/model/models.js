sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/ui/Device"
], function (JSONModel, Device) {
    "use strict";

    return {
        /**
         * Provides runtime info for the device the UI5 app is running on as JSONModel
         */
        createDeviceModel: function () {
            var oModel = new JSONModel(Device);
            oModel.setDefaultBindingMode("OneWay");
            return oModel;
        },

        // Create local Model
        createLocalModel: function () {
            var oModel = new JSONModel({
                // Default to JP Mode
                pasteMode: "1",  // ADD BY XINLEIX XU 2026/06/10 TH-P-027
                // ADD BEGIN BY XINLEI XU 2026/07/17 VN CR#6718
                filter: {
                    FromBOMTable: false
                },
                resultSet: []
                // ADD END BY XINLEI XU 2026/07/17 VN CR#6718
            });
            return oModel;
        },
    };

});