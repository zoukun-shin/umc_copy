sap.ui.define([], function() {
	"use strict";

	return {

		//格式化实际成本获取方式
		formatCostDetermination: function(sValue) {
			var oBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
			switch (sValue) {
				case "1":
					return oBundle.getText("CostDetermination_1");
				case "2":
					return oBundle.getText("CostDetermination_2");
				default:
					return "";
			}
		}

	};

});