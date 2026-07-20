sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "./messages",
    "sap/ui/model/Filter",
    "../model/formatter"
], function(Controller, messages, Filter, formatter) {
    "use strict";
    return Controller.extend("sd.achievementrate.controller.IntercompanyTP", {

        formatter: formatter,

        onBeforeRebindTable: function(oEvent) {
            var oBindingParams = oEvent.getParameter("bindingParams");
            var oFilter = oBindingParams.filters;
            var aNewFilter = [];

            // 目前 Tab2 无自定义筛选逻辑

            if (aNewFilter.length > 0) {
                oFilter.push(new Filter({ filters: aNewFilter, and: true }));
            }
        }
    });
});
