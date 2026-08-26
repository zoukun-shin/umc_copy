sap.ui.define([
    "./BaseController",
    "./messages",
    "sap/ui/model/Filter",
    "../model/formatter",
], (BaseController, messages, Filter, formatter) => {
    "use strict";
    return BaseController.extend("sd.invoicedomestic.controller.InvoiceDetail", {
        formatter: formatter,
        onInit() {},
        onSearch() {
            this.byId("idSmartTable").rebindTable();
        },
        /*eslint max-statements: ["error", 80,{ "ignoreTopLevelFunctions": true }]*/
        onBeforeRebindTable(oEvent) {
            var oFilter = oEvent.getParameter("bindingParams").filters;
            var oNewFilter, aNewFilter = [];
            // 自定义筛选逻辑在此添加

            // 获取日期范围
            var oDateRange, oStartDate, oEndDate;
            oDateRange = this.byId("idDRBillingDocumentDate");
            oStartDate = oDateRange.getFrom();
            oEndDate = oDateRange.getTo();
            if (oDateRange.getDateValue()) {
                aNewFilter.push(new Filter("BillingDocumentDate", "BT", formatter.odataDate(oStartDate), formatter.odataDate(oEndDate)));
            }
            oDateRange = this.byId("idDRPlannedGoodsIssueDate");
            oStartDate = oDateRange.getFrom();
            oEndDate = oDateRange.getTo();
            if (oDateRange.getDateValue()) {
                aNewFilter.push(new Filter("PlannedGoodsIssueDate", "BT", formatter.odataDate(oStartDate), formatter.odataDate(oEndDate)));
            }
            oDateRange = this.byId("idDRAccountingPostingDate");
            oStartDate = oDateRange.getFrom();
            oEndDate = oDateRange.getTo();
            if (oDateRange.getDateValue()) {
                aNewFilter.push(new Filter("AccountingPostingDate", "BT", formatter.odataDate(oStartDate), formatter.odataDate(oEndDate)));
            }
            oDateRange = this.byId("idDRCreationDate");
            oStartDate = oDateRange.getFrom();
            oEndDate = oDateRange.getTo();
            if (oDateRange.getDateValue()) {
                aNewFilter.push(new Filter("CreationDate", "BT", formatter.odataDate(oStartDate), formatter.odataDate(oEndDate)));
            }
            oDateRange = this.byId("idDRNetDueDate");
            oStartDate = oDateRange.getFrom();
            oEndDate = oDateRange.getTo();
            if (oDateRange.getDateValue()) {
                aNewFilter.push(new Filter("NetDueDate", "BT", formatter.odataDate(oStartDate), formatter.odataDate(oEndDate)));
            }
            
            // CheckBox 过滤
            var bShowAllInvoices = this.byId("idCBShowAllInvoices").getSelected();
            var bShowBatchParent = this.byId("idCBShowBatchParent").getSelected();
            var bShowZeroPrice = this.byId("idCBShowZeroPrice").getSelected();
            // var bShowInternalDelivery = this.byId("idCBShowInternalDelivery").getSelected();

            if (bShowAllInvoices === true) {
                aNewFilter.push(new Filter("ShowAllInvoices", "EQ", true));
            }
            if (bShowBatchParent === true) {
                aNewFilter.push(new Filter("ShowBatchParent", "EQ", true));
            }
            if (bShowZeroPrice === true) {
                aNewFilter.push(new Filter("ShowZeroPrice", "EQ", true));
            }
            // if (bShowInternalDelivery === true) {
            //     aNewFilter.push(new Filter("ShowInternalDelivery", "EQ", true));
            // }

            // Cleared 下拉框筛选
            var sCleared = this.byId("idClearedSelect").getSelectedKey();
            if (sCleared === "cleared") {
                aNewFilter.push(new Filter("Cleared", "EQ", true));
            } else if (sCleared === "uncleared") {
                aNewFilter.push(new Filter("Cleared", "EQ", false));
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
