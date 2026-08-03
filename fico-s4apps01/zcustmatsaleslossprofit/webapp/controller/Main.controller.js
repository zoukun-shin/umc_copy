sap.ui.define([
    "sap/ui/core/mvc/Controller"
], (Controller) => {
    "use strict";

    return Controller.extend("fico.zcustmatsaleslossprofit.controller.Main", {
        onInit() {
        },

        onBeforeRebindTable:function(oEvent){
            var oBindingParams = oEvent.getParameter("bindingParams");
			oBindingParams.parameters = oBindingParams.parameters || {}; 
            var oSmartTable = oEvent.getSource();
			var oSmartFilterBar = this.byId(oSmartTable.getSmartFilterId()); 

            //发票年月
            var oCustomControl_YearMonth = oSmartFilterBar.getControlByKey("YearMonth");
            var vYearMonth = oCustomControl_YearMonth.getValue();
            oBindingParams.filters.push(new sap.ui.model.Filter("YearMonth", "EQ", vYearMonth));

            //清单类型
			var oCustomControl_ReportType = oSmartFilterBar.getControlByKey("ReportType"); 
			var vReportType = oCustomControl_ReportType.getSelectedKey();
            oBindingParams.filters.push(new sap.ui.model.Filter("ReportType", "EQ", vReportType));
			 
        }
    });
});