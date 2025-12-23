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
                Control: {
                    editable: false,
                    showFooter: false
                },
                NG_Header: {
                    Plant: ""
                },
                NG_Item: [],
                NG_ItemIQC: []
            });
            return oModel;
        },
    };
});