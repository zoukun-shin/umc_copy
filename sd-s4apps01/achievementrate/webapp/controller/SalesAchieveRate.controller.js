sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "./messages",
    "sap/ui/model/Filter",
    "../model/formatter"
], function(Controller, messages, Filter, formatter) {
    "use strict";
    return Controller.extend("sd.achievementrate.controller.SalesAchieveRate", {

        formatter: formatter,

        onBeforeRebindTable: function(oEvent) {
            var oBindingParams = oEvent.getParameter("bindingParams");
            var oFilter = oBindingParams.filters;
            var aNewFilter = [];

            // 日期范围筛选
            var oDateRange = this.byId("idDRWorkingDayDate");
            var oStartDate = oDateRange.getFrom();
            var oEndDate = oDateRange.getTo();
            if (oDateRange.getDateValue()) {
                aNewFilter.push(new Filter(
                    "WorkingDayDate", "BT",
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
