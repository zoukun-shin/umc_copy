sap.ui.define([
    "sap/m/BusyDialog",
    "sap/ui/model/Filter",
    "sap/m/MessageToast",
    "../model/formatter",
    "../lib/xml-js",
    "./messages",
    "./Base"
], (BusyDialog, Filter, MessageToast, formatter, xml, messages, Base) => {
    "use strict";

    var _ResourceBundle, _oPrintModel;

    return Base.extend("fico.paymentproxy.controller.Report", {
        formatter: formatter,

        onInit() {
            this._LocalData = this.getOwnerComponent().getModel("local");
            this._oDataModel = this.getOwnerComponent().getModel();
            this._ResourceBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
            this._BusyDialog = new BusyDialog();
            _oPrintModel = this.getOwnerComponent().getModel("Print");
            _ResourceBundle = this._ResourceBundle;

            // 业务动作：上传页签保存成功后刷新报表
            this.getOwnerComponent().getEventBus().subscribe("paymentproxy", "refreshReport", this._onRefreshReport, this);
        },

        _onRefreshReport: function () {
            var oSmartTable = this.byId("idSmartTable");
            if (oSmartTable) {
                oSmartTable.rebindTable();
            }
        },

        onBeforeRebindTable: function (oEvent) {
            var oFilter = oEvent.getParameter("bindingParams").filters;
            var aNewFilter = [];

            // 付款日期区间筛选（DateRangeSelection → BT 条件）
            var oDateRange = this.byId("idDRPaymentDate");
            if (oDateRange) {
                var oStartDate = oDateRange.getDateValue();
                var oEndDate = oDateRange.getSecondDateValue();
                if (oStartDate && oEndDate) {
                    aNewFilter.push(new Filter("PaymentDate", "BT",
                        formatter.odataDate(oStartDate),
                        formatter.odataDate(oEndDate)));
                }
            }

            if (aNewFilter.length > 0) {
                oFilter.push(new Filter({ filters: aNewFilter, and: true }));
            }
        },

        preparePostBody: function () {
            var aSelected = this.byId("idMultiSelectionPlugin").getSelectedIndices();
            var aRows = [];
            aSelected.forEach(function (i) {
                var sPath = this.byId("idReportTable").getContextByIndex(i).getPath();
                var oRow = this.getModel().getObject(sPath);
                delete oRow.__metadata;
                aRows.push(oRow);
            }.bind(this));
            return aRows;
        },

        onPrint: function () {
            var aRows = this.preparePostBody();
            if (!aRows.length) {
                MessageToast.show(_ResourceBundle.getText("noSelect"));
                return;
            }
            // 业务动作：选中行合并生成一份付款委托书 PDF
            var pdfContent = this._buildPrintContent(aRows);
            this._getPDF(pdfContent);
        },

        _buildPrintContent: function (aRows) {
            var aItems = [];
            aRows.forEach(function (row) {
                aItems.push({
                    CompanyCode: row.CompanyCode,
                    Supplier: row.Supplier,
                    PaymentDate: this._formatDate(row.PaymentDate),
                    PaymentMethod: row.PaymentMethod,
                    Currency: row.Currency,
                    Responsible: row.Responsible,
                    TransactionAmount: row.TransactionAmount,
                    PaymentAmount: row.PaymentAmount,
                    SupplierName: row.SupplierName,
                    FeeAmount: row.FeeAmount,
                    BankCountryKey: row.BankCountryKey,
                    BankAccountHolderName: row.BankAccountHolderName,
                    BankAccount: row.BankAccount,
                    BankAddress: row.BankAddress,
                    BankName: row.BankName
                });
            }.bind(this));
            return {
                PrintData: {
                    Printer: this._LocalData.getProperty("/currentUser") || "",
                    to_Items: {
                        results: aItems
                    }
                }
            };
        },

        _formatDate: function (oValue) {
            if (!oValue) {
                return "";
            }
            if (oValue instanceof Date) {
                var y = oValue.getFullYear();
                var m = oValue.getMonth() + 1;
                var d = oValue.getDate();
                return "" + y + (m < 10 ? "0" : "") + m + (d < 10 ? "0" : "") + d;
            }
            return oValue;
        },

        _getPDF: function (pdfContent) {
            var that = this;
            var oBusyDialog = new BusyDialog();
            var sFileName = _ResourceBundle.getText("appTitle") + this._currentDateTime();

            oBusyDialog.open();
            try {
                var createPrintRecord = _oPrintModel.bindContext("/PrintRecord/com.sap.gateway.srvd.zui_prt_record_o4.v0001.createPrintRecord(...)");
                createPrintRecord.setParameter("TemplateID", "YY1_FICO046");
                createPrintRecord.setParameter("IsExternalProvidedData", true);
                var oXMLData = json2xml(pdfContent, {
                    compact: true,
                    ignoreComment: true,
                    spaces: 4
                });
                var pdfData = btoa(unescape(encodeURIComponent("<?xml version=\"1.0\" encoding=\"UTF-8\"?><form>" + oXMLData + "</form>")));
                createPrintRecord.setParameter("ExternalProvidedData", pdfData);
                createPrintRecord.setParameter("ProvidedKeys", "");
                createPrintRecord.setParameter("ResultIsActiveEntity", true);
                createPrintRecord.setParameter("FileName", sFileName);
                createPrintRecord.execute("$auto", false, null, false).then(function () {
                    var boundContext = createPrintRecord.getBoundContext();
                    var object = boundContext.getObject();
                    var sPath = _oPrintModel.getKeyPredicate("/PrintRecord", object);
                    var sURL = _oPrintModel.getServiceUrl() + "PrintRecord" + sPath + "/PDFContent";
                    sap.m.URLHelper.redirect(sURL, true);
                    oBusyDialog.close();
                    MessageToast.show(_ResourceBundle.getText("printSuccess"));
                }).catch(function (oError) {
                    oBusyDialog.close();
                    messages.showError(oError.message);
                });
            } catch (error) {
                oBusyDialog.close();
                messages.showError(error.message);
            }
        },

        _currentDateTime: function () {
            var oDate = new Date();
            var pad = function (n) {
                return n < 10 ? "0" + n : "" + n;
            };
            return "" + oDate.getFullYear() + pad(oDate.getMonth() + 1) + pad(oDate.getDate()) +
                pad(oDate.getHours()) + pad(oDate.getMinutes()) + pad(oDate.getSeconds());
        }
    });
});
