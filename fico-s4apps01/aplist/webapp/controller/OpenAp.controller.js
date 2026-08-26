sap.ui.define([
    "./Base",
    "./messages",
    "sap/ui/model/Filter",
    "../model/formatter",
    "sap/m/BusyDialog"
], (Base, messages, Filter, formatter, BusyDialog) => {
    "use strict";

    return Base.extend("fico.aplist.controller.OpenAp", {
        formatter: formatter,

        onInit() {
            this._LocalData = this.getOwnerComponent().getModel("local");
            this._oDataModel = this.getOwnerComponent().getModel();
            this._ResourceBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
            this._BusyDialog = new BusyDialog();
        },

        onBeforeRebindTable: function (oEvent) {
            var oFilter = oEvent.getParameter("bindingParams").filters;
            var aNewFilter = [];

            // 到期日区间筛选
            var oDateRange = this.byId("idDRNetDueDate");
            var oStartDate = oDateRange.getDateValue();
            var oEndDate = oDateRange.getSecondDateValue();
            if (oStartDate && oEndDate) {
                aNewFilter.push(new Filter(
                    "NetDueDate", "BT",
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
