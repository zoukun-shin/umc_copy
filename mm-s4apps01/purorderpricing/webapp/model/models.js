sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/ui/Device"
],
function (JSONModel, Device) {
    "use strict";

    return {
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
                        Execute: false,
                        Export: false
                    }
                }
            });
            return oModel;
        }
    };
});