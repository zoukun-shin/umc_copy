sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/ui/Device"
], 
function (JSONModel, Device) {
    "use strict";

    return {
        /**
         * Provides runtime information for the device the UI5 app is running on as a JSONModel.
         * @returns {sap.ui.model.json.JSONModel} The device model.
         */
        createDeviceModel: function () {
            var oModel = new JSONModel(Device);
            oModel.setDefaultBindingMode("OneWay");
            return oModel;
        },

        createLocalModel: function () {
            var oModel = new JSONModel({
                logInfo: "",
                excelSet: [],
                recordCheckSuccessed: false,
                busy: false,
                authorityCheck: {
                    button: {
                        View: false,
                        Upload: false,
                        Check: false,
                        Save: false,
                        Export: false,
                        Print: false
                    }
                }
            });
            return oModel;
        }
    };

});