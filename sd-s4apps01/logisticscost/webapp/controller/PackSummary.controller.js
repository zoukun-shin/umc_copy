sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "../model/formatter"
], function(Controller, Filter, formatter) {
    "use strict";
    return Controller.extend("sd.logisticscost.controller.PackSummary", {

        formatter: formatter,

        onInit() {},

        onBeforeRebindTable: function(oEvent) {
            var oBindingParams = oEvent.getParameter("bindingParams");
            var oFilter = oBindingParams.filters;
            var aNewFilter = [];

            var oDateRange = this.byId("idDRPlannedGoodsIssueDate");
            var oStartDate = oDateRange.getDateValue();
            var oEndDate = oDateRange.getSecondDateValue();
            if (oStartDate && oEndDate) {
                aNewFilter.push(new Filter(
                    "PlannedGoodsIssueDate", "BT",
                    formatter.odataDate(oStartDate),
                    formatter.odataDate(oEndDate)
                ));
            }

            if (aNewFilter.length > 0) {
                oFilter.push(new Filter({ filters: aNewFilter, and: true }));
            }
        }
    });
});
