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
        
        // 初始化本地数据集
		_initialLocalData : function() {
			var localData = {
				busy: false,
				hasUIChanges : false,
				errors: "",
				excelSet: [],
				upload: [{}],
				recordCheckSuccessed: false,
				objectPageEditable: false
			};
			return localData;
		},
		// 创建本地模型
		createLocalModel : function() {
			var oModel = new JSONModel(this._initialLocalData());
			oModel.setSizeLimit(9999);
			return oModel;
		},
    };

});