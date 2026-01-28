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
                NG_Header: {
                    NG_No: "",
                    Plant: "",
                    PlantName: "",
                    MoveType: "1",
                    MaterialType: "1",
                    to_NG_Item: {
                        results: []
                    }
                },
                Control: {
                    requiredSelection: false,
                    enabled: false,
                    editable: false,
                    showFooter: false,
                    itemNotPosted: true
                },
                MessageItems: [],
                OperationLogs: [],
                MoveTypeVH: [],
                MaterialTypeVH: []
            });
            return oModel;
        },
    };
});