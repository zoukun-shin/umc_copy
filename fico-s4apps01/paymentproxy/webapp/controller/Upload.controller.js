sap.ui.define([
    "sap/m/BusyDialog",
    "../model/formatter",
    "../lib/xlsx",
    "sap/ui/export/Spreadsheet",
    "./messages",
    "./Base"
], (BusyDialog, formatter, xlsx, Spreadsheet, messages, Base) => {
    "use strict";

    // 后端响应 Zzkey 键为大写，映射回本地 excelSet 字段
    var aFieldMap = [
        ["COMPANYCODE", "CompanyCode"],
        ["SUPPLIER", "Supplier"],
        ["PAYMENTDATE", "PaymentDate"],
        ["PAYMENTMETHOD", "PaymentMethod"],
        ["TRANSACTIONAMOUNT", "TransactionAmount"],
        ["PAYMENTAMOUNT", "PaymentAmount"],
        ["CURRENCY", "Currency"],
        ["RESPONSIBLE", "Responsible"],
        ["SUPPLIERNAME", "SupplierName"],
        ["FEEAMOUNT", "FeeAmount"],
        ["BANKCOUNTRYKEY", "BankCountryKey"],
        ["BANKACCOUNTHOLDERNAME", "BankAccountHolderName"],
        ["BANKACCOUNT", "BankAccount"],
        ["BANKADDRESS", "BankAddress"],
        ["BANKNAME", "BankName"]
    ];

    return Base.extend("fico.paymentproxy.controller.Upload", {
        formatter: formatter,

        onInit() {
            this._LocalData = this.getOwnerComponent().getModel("local");
            this._oDataModel = this.getOwnerComponent().getModel();
            this._ResourceBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
            this._BusyDialog = new BusyDialog();
        },

        onAfterRendering: function () {
            // 模板下载列表只显示当前应用的模板
            if (!this._bTemplateFiltered) {
                var oFilter = new sap.ui.model.Filter("Object", sap.ui.model.FilterOperator.EQ, "ZUPLOAD_PAYMENT");
                var oControlBinding = this.byId("idTemplateCollection").getBinding("items");
                if (oControlBinding) {
                    oControlBinding.filter(oFilter);
                }
                this._bTemplateFiltered = true;
            }
        },

        onFileUploaderChange: function (oEvent) {
            this._LocalData.setProperty("/logInfo", "");
            this._LocalData.setProperty("/recordCheckSuccessed", false);
            var oFile = oEvent.getParameter("files")[0];
            if (!oFile) {
                this._LocalData.setProperty("/excelSet", []);
                return;
            }

            var oReader = new FileReader();
            oReader.readAsArrayBuffer(oFile);
            oReader.onload = function (e) {
                var sResult = e.target.result;
                /*global XLSX*/
                var oWB = XLSX.read(sResult, {
                    type: "binary",
                    cellDates: true,
                    dateNF: "yyyy/mm/dd;@"
                });
                var oSheet1 = oWB.Sheets[oWB.SheetNames[0]];
                var aSheet1 = XLSX.utils.sheet_to_row_object_array(oSheet1, { raw: false });
                this.readSheet(aSheet1);
            }.bind(this);
        },

        readSheet: function (aSheet1) {
            var aExcelSet = [];
            for (var i = 1; i < aSheet1.length; i++) {
                var oItem = {
                    Type: "",
                    Message: "",
                    Tabix: i,
                    CompanyCode: aSheet1[i].CompanyCode || "",
                    Supplier: aSheet1[i].Supplier || "",
                    PaymentDate: formatter.odataDate(aSheet1[i].PaymentDate) || "",
                    PaymentMethod: aSheet1[i].PaymentMethod || "",
                    TransactionAmount: aSheet1[i].TransactionAmount || "",
                    PaymentAmount: "",
                    Currency: aSheet1[i].Currency || "",
                    Responsible: aSheet1[i].Responsible || "",
                    SupplierName: "",
                    FeeAmount: "",
                    BankCountryKey: "",
                    BankAccountHolderName: "",
                    BankAccount: "",
                    BankAddress: "",
                    BankName: ""
                };
                aExcelSet.push(oItem);
            }
            if (aExcelSet.length === 0) {
                return;
            }
            this._LocalData.setProperty("/excelSet", aExcelSet);
        },

        onCheck: function () {
            this.postAction("processLogic", "check");
        },

        onSave: function () {
            this.postAction("processLogic", "save");
        },

        postAction: function (sAction, sEvent) {
            var aExcelSet = this._LocalData.getProperty("/excelSet");
            this._BusyDialog.open();

            this._oDataModel.callFunction(`/${sAction}`, {
                method: "POST",
                urlParameters: {
                    Event: sEvent,
                    Zzkey: JSON.stringify(aExcelSet)
                },
                success: function (oData) {
                    var aResult = JSON.parse(oData[sAction].Zzkey);
                    this._mergeResponse(aResult, aExcelSet);
                    this._LocalData.setProperty("/excelSet", aExcelSet);
                    this.getErrorCount(aExcelSet, sEvent);
                    if (sEvent === "save") {
                        // 业务动作：保存成功后通知报表页签刷新
                        this.getOwnerComponent().getEventBus().publish("paymentproxy", "refreshReport");
                    }
                    this._BusyDialog.close();
                }.bind(this),
                error: function (oError) {
                    messages.showError(messages.parseErrors(oError));
                    this._BusyDialog.close();
                }.bind(this)
            });
        },

        _mergeResponse: function (aResult, aExcelSet) {
            aResult.forEach(function (line) {
                var item = aExcelSet.find(function (i) {
                    return `${i.Tabix}` === `${line.TABIX}`;
                });
                if (!item) {
                    return;
                }
                aFieldMap.forEach(function (mapping) {
                    if (line[mapping[0]] !== undefined) {
                        // 付款日期统一转成 Date 对象，避免覆盖后表格 type:Date 渲染异常
                        if (mapping[0] === "PAYMENTDATE") {
                            var sDate = line[mapping[0]];
                            if (typeof sDate === "string" && /^\d{8}$/.test(sDate)) {
                                sDate = sDate.substring(0, 4) + "-" + sDate.substring(4, 6) + "-" + sDate.substring(6);
                            }
                            item[mapping[1]] = formatter.odataDate(sDate);
                        } else {
                            item[mapping[1]] = line[mapping[0]];
                        }
                    }
                });
                if (line.TYPE !== undefined) {
                    item.Type = line.TYPE;
                }
                if (line.MESSAGE !== undefined) {
                    item.Message = line.MESSAGE;
                }
            });
        },

        getErrorCount: function (aExcelSet, sAction) {
            var iTotal = 0,
                iError = 0,
                iSuccess = 0;
            iTotal = aExcelSet.length;
            aExcelSet.forEach(function (value) {
                if (value.Type === "E") {
                    iError++;
                } else {
                    iSuccess++;
                }
            });
            var sLogInfo = this._ResourceBundle.getText("logInfo", [iTotal, iSuccess, iError]);
            this._LocalData.setProperty("/logInfo", sLogInfo);
            if (iError > 0) {
                return;
            }
            switch (sAction) {
                case "check":
                    this._LocalData.setProperty("/recordCheckSuccessed", true);
                    break;
                case "save":
                    this._LocalData.setProperty("/recordCheckSuccessed", false);
                    break;
            }
        },

        onExport: function (oEvent) {
            var sId = oEvent.getSource().getParent().getParent().getId();
            var oTable = this.getView().byId(sId);
            var sPath = oTable.getBindingPath("rows");
            var aExcelSet = this._LocalData.getProperty(sPath);

            var oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({ pattern: "yyyyMMdd" });
            var oTimeFormat = sap.ui.core.format.DateFormat.getTimeInstance({ pattern: "HHmmss" });
            var sFileName = this._ResourceBundle.getText("title") + "_" +
                oDateFormat.format(new Date()) + oTimeFormat.format(new Date());

            var aExcelCol = [];
            var aTableCol = oTable.getColumns();

            aExcelCol.push({
                label: this._ResourceBundle.getText("Status"),
                type: "string",
                property: "Type",
                width: 8
            });
            for (var i = 1; i < aTableCol.length; i++) {
                if (aTableCol[i].getVisible()) {
                    var sLabelText = aTableCol[i].getAggregation("label").getText();
                    var sProperty = aTableCol[i].getAggregation("template").getBindingPath("text");
                    let oType = aTableCol[i].getAggregation("template").getBindingInfo("text").type;
                    let sType = "string";
                    if (oType?.getName() === "Date") {
                        sType = "Date";
                    }
                    aExcelCol.push({
                        label: sLabelText,
                        type: sType,
                        property: sProperty,
                        width: parseFloat(aTableCol[i].getWidth())
                    });
                }
            }
            var oSettings = {
                workbook: {
                    columns: aExcelCol,
                    context: {
                        version: "${version}",
                        hierarchyLevel: "level"
                    }
                },
                dataSource: aExcelSet,
                fileName: sFileName
            };
            new Spreadsheet(oSettings).build();
        }
    });
});
