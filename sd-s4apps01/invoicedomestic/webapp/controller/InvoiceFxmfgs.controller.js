sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "./messages",
    "sap/ui/model/Filter",
    "../model/formatter",
], (Controller, messages, Filter, formatter) => {
    "use strict";
    return Controller.extend("sd.invoicedomestic.controller.InvoiceFxmfgs", {
        formatter: formatter,
        onInit() {},
        onSearch() {
            this.byId("idSmartTable2").rebindTable();
        },
        onBeforeRebindTable(oEvent) {
            var oFilter = oEvent.getParameter("bindingParams").filters;
            var oNewFilter, aNewFilter = [];

            // 获取日期范围
            var oDateRange, oStartDate, oEndDate;
            oDateRange = this.byId("idDRCreationDate");
            oStartDate = oDateRange.getFrom();
            oEndDate = oDateRange.getTo();
            if (oDateRange.getDateValue()) {
                aNewFilter.push(new Filter("CreationDate", "BT", formatter.odataDate(oStartDate), formatter.odataDate(oEndDate)));
            }
            oDateRange = this.byId("idDRBillingDocumentDate");
            oStartDate = oDateRange.getFrom();
            oEndDate = oDateRange.getTo();
            if (oDateRange.getDateValue()) {
                aNewFilter.push(new Filter("BillingDocumentDate", "BT", formatter.odataDate(oStartDate), formatter.odataDate(oEndDate)));
            }

            // CheckBox 过滤
            var bShowBatchParent = this.byId("idCBShowBatchParent").getSelected();
            var bShowZeroPrice = this.byId("idCBShowZeroPrice").getSelected();
            var bShowInternalDelivery = this.byId("idCBShowInternalDelivery").getSelected();

            if (bShowBatchParent === true) {
                aNewFilter.push(new Filter("ShowBatchParent", "EQ", true));
            }
            if (bShowZeroPrice === true) {
                aNewFilter.push(new Filter("ShowZeroPrice", "EQ", true));
            }
            if (bShowInternalDelivery === true) {
                aNewFilter.push(new Filter("ShowInternalDelivery", "EQ", true));
            }

            oNewFilter = new Filter({
                filters: aNewFilter,
                and: true
            });
            if (aNewFilter.length > 0) {
                oFilter.push(oNewFilter);
            }
        }
    });
});
