sap.ui.define([
    "./Base",
    "./messages",
    "sap/ui/model/Filter",
    "../model/formatter",
    "sap/m/BusyDialog"
], (Base, messages, Filter, formatter, BusyDialog) => {
    "use strict";

    return Base.extend("fico.aplist.controller.AutoPay", {
        formatter: formatter,

        onInit() {
            this._LocalData = this.getOwnerComponent().getModel("local");
            this._oDataModel = this.getOwnerComponent().getModel();
            this._ResourceBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
            this._BusyDialog = new BusyDialog();
        },

        onBeforeRebindTable: function (oEvent) {
            var mParams = oEvent.getParameter("bindingParams");
            var oFilter = mParams.filters;

            var oDateRange = this.byId("idDRPaymentRunDate");
            var oStartDate = oDateRange.getDateValue();
            var oEndDate = oDateRange.getSecondDateValue();

            // 付款运行日期区间筛选
            var aNewFilter = [];
            if (oStartDate && oEndDate) {
                aNewFilter.push(new Filter(
                    "PaymentRunDate", "BT",
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
