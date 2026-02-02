sap.ui.define([
    "./Base",
    "../model/formatter",
    "sap/m/BusyDialog",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/Fragment",
    "sap/ui/export/Spreadsheet",
    "../lib/xml-js",
], (Base, formatter, BusyDialog, MessageBox, MessageToast, Filter, FilterOperator, Fragment, Spreadsheet, xml) => {
    "use strict";
    var _oFunctions, _ResourceBundle, _oPrintModel;
    return Base.extend("pp.fglabel.controller.List", {
        formatter: formatter,

        onInit() {
            _oFunctions = this;
            var that = this;
            this._LocalData = this.getOwnerComponent().getModel("local");
            this._oDataModel = this.getOwnerComponent().getModel();
            this._oDataModel.setRefreshAfterChange(false);
            this._BusyDialog = new BusyDialog();
            if (sap.ushell && sap.ushell.Container) {
                this._UserInfo = sap.ushell.Container.getService("UserInfo").getUser();
            };
            this.getRouter().getRoute("Main").attachMatched(this._initialize, this);
        },

        _initialize: function () {

        },

        onBeforeRebindTable: function (oEvent) {
            let aFilters = oEvent.getParameters().bindingParams.filters;
            let oSmartFilterBar = this.byId("idSmartFilterBar");
            //Barcode No/WO No/WO Start Date must input at least one!
            let sBarcode = oSmartFilterBar.getFilterData().Barcode;
            let sWO_Order = oSmartFilterBar.getFilterData().WO_Order;
            let sWOStartDate = this.byId("dateRange").getDateValue();
            if (!sBarcode && !sWO_Order && !sWOStartDate) {
                MessageBox.error(this.getResourceBundle().getText("msg004"));
                this.removeFilterByPath(aFilters, "Plant");
                return;
            };
            let oRange = this.byId("dateRange");
            if (oRange.getFrom()) {
                var sfromDate = `${oRange.getFrom().getFullYear()}${(oRange.getFrom().getMonth() + 1).toString().padStart(2, "0")}${oRange.getFrom().getDate().toString().padStart(2, "0")}`;
                var stoDate = `${oRange.getTo().getFullYear()}${(oRange.getTo().getMonth() + 1).toString().padStart(2, "0")}${oRange.getTo().getDate().toString().padStart(2, "0")}`;
                let oStartdate = new sap.ui.model.Filter({
                    path: "WO_Start_Date",
                    operator: "BT",
                    value1: sfromDate,
                    value2: stoDate
                });
                aFilters.push(oStartdate);
            };
            let sCount = this.byId("cbCount").getSelectedKey();
            let oCount = new sap.ui.model.Filter({
                path: "Print_Count",
                operator: "EQ",
                value1: sCount
            });
            aFilters.push(oCount);
            let sDel = this.byId("cbDelete").getSelectedKey();
            let oDel = new sap.ui.model.Filter({
                path: "Delete_Flag",
                operator: "EQ",
                value1: sDel
            });
            aFilters.push(oDel);
            let sEmail = this._UserInfo.getEmail() === undefined ? "" : this._UserInfo.getEmail();
            aFilters.push(new sap.ui.model.Filter("UserEmail", "EQ", sEmail));
        },
        removeFilterByPath: function (aFilters, sPath) {
            for (let i = aFilters.length - 1; i >= 0; i--) {
                let oFilter = aFilters[i];
                if (oFilter.sPath === sPath) {
                    aFilters.splice(i, 1);
                    continue;
                }
                if (oFilter.aFilters && oFilter.aFilters.length) {
                    this.removeFilterByPath(oFilter.aFilters, sPath);
                    if (oFilter.aFilters.length === 0) {
                        aFilters.splice(i, 1);
                    }
                }
            }
        },

        onDateRangeChange: function (oEvent) {
            let oDRS = oEvent.getSource();
            let oStart = oDRS.getDateValue();          // Date object
            let oEnd = oDRS.getSecondDateValue();      // Date object
            if (!oStart || !oEnd) {
                oDRS.setValueState("None");
                return;
            }
            var iDiff = Math.abs((oEnd - oStart) / (1000 * 60 * 60 * 24));
            //WO_Start_Date range must be in 2 week
            if (iDiff > 14) {
                MessageBox.error(this.getResourceBundle().getText("msg005"));
                return;
            }
        },

        onDelete: function (oEvent) {
            var that = this;
            var postDocs = this.preparePostBody();
            if (!postDocs) {
                //"Please select at least one line!"
                messages.showError(this.getResourceBundle().getText("msg006"));
                return;
            };

            MessageBox.confirm(this.getModel("i18n").getResourceBundle().getText("info002"), {
                actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                emphasizedAction: MessageBox.Action.OK,
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        that._BusyDialog.open();
                        that._CallODataV2("ACTION", "/processLogic", [], {
                            "Zzkey": postDocs,
                            "Event": "DELETE",
                            "UserEmail": that._UserInfo.getEmail() === undefined ? "" : that._UserInfo.getEmail()
                        }, {}).then(function (oResponse) {
                            that.byId("idMessage").setVisible(true);
                            var result = JSON.parse(oResponse.processLogic.Zzkey);
                            result.ITEMS.forEach(element => {
                                var sPath = that.getModel().createKey("/FGLabel", {
                                    Plant: element.PLANT,
                                    Barcode: element.BARCODE,
                                });
                                that.getModel().setProperty(sPath + "/Message", element.MESSAGE);
                                that.getModel().setProperty(sPath + "/Delete_Flag", element.DELETE_FLAG);
                                that.getModel().setProperty(sPath + "/Change_Date", element.CHANGE_DATE);
                                that.getModel().setProperty(sPath + "/Change_Time", element.CHANGE_TIME);
                                that.getModel().setProperty(sPath + "/Change_User", element.CHANGE_USER);
                            });
                            that._BusyDialog.close();
                        }, function (oError) {
                            MessageBox.error(oError.message);
                        });
                    }
                },
            });
        },

        onAfterRendering: function (oEvent) {
            var sVisible = this.byId("idMessage").getVisible();
            if (sVisible) {
                setTimeout(() => {
                    this.byId("idMessage").setVisible(true);
                }, 100);
            } else {
                this.byId("idMessage").setVisible(false);
            }
        },

        onReset: function (oEvent) {
            var that = this;
            var postDocs = this.preparePostBody();
            if (!postDocs) {
                //"Please select at least one line!"
                messages.showError(this.getResourceBundle().getText("msg006"));
                return;
            };

            MessageBox.confirm(this.getModel("i18n").getResourceBundle().getText("info003"), {
                actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                emphasizedAction: MessageBox.Action.OK,
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        that._BusyDialog.open();
                        that._CallODataV2("ACTION", "/processLogic", [], {
                            "Zzkey": postDocs,
                            "Event": "RESET",
                            "UserEmail": that._UserInfo.getEmail() === undefined ? "" : that._UserInfo.getEmail()
                        }, {}).then(function (oResponse) {
                            that.byId("idMessage").setVisible(true);
                            var result = JSON.parse(oResponse.processLogic.Zzkey);
                            result.ITEMS.forEach(element => {
                                var sPath = that.getModel().createKey("/FGLabel", {
                                    Plant: element.PLANT,
                                    Barcode: element.BARCODE,
                                });
                                that.getModel().setProperty(sPath + "/Message", element.MESSAGE);
                                that.getModel().setProperty(sPath + "/Delete_Flag", element.DELETE_FLAG);
                                that.getModel().setProperty(sPath + "/Change_Date", element.CHANGE_DATE);
                                that.getModel().setProperty(sPath + "/Change_Time", element.CHANGE_TIME);
                                that.getModel().setProperty(sPath + "/Change_User", element.CHANGE_USER);
                            });
                            that._BusyDialog.close();
                        }, function (oError) {
                            MessageBox.error(oError.message);
                        });
                    }
                },
            });
        },

        preparePostBody: function () {
            var that = this;
            var listItems = this.byId("idMultiSelectionPlugin").getSelectedIndices();
            var selectedRows = [];
            listItems.forEach((item) => {
                var sPath = this.byId("ReportTable").getContextByIndex(item).getPath();
                var oRow = this.getModel().getObject(sPath);
                delete oRow.__metadata;
                selectedRows.push(oRow);
            });
            let postDocs = [JSON.stringify(selectedRows)];
            return postDocs;
        },

        onPrintEN: function (oEvent) {
            var that = this;
            _ResourceBundle = this.getModel("i18n").getResourceBundle();
            _oPrintModel = this.getModel("Print");
            var aItems = this.preparePostBody();
            _oFunctions.onCustomAction(aItems, "PRINTEN");
        },

        onPrintVN: function (oEvent) {
            var that = this;
            _ResourceBundle = this.getModel("i18n").getResourceBundle();
            _oPrintModel = this.getModel("Print");
            var aItems = this.preparePostBody();
            _oFunctions.onCustomAction(aItems, "PRINTVN");
        },

        onCustomAction: function (aSelectedContexts, sActionName) {
            _oFunctions.printAction(aSelectedContexts, sActionName)
                .then(function (records) {
                    //按 Template 分组
                    const mTemplateGroup = {};
                    records.forEach(item => {
                        const sTemplate = item.PRINTTEMPLATE;
                        if (!mTemplateGroup[sTemplate]) {
                            mTemplateGroup[sTemplate] = [];
                        }
                        mTemplateGroup[sTemplate].push(item);
                    });
                    //每个模板单独生成 PDF
                    Object.keys(mTemplateGroup).forEach(sTemplateID => {
                        const aItems = mTemplateGroup[sTemplateID];
                        const pdfContent = _oFunctions.porcessPrintContent(aItems);
                        _oFunctions.getPDF(aItems, pdfContent, sTemplateID);
                    });
                });
        },

        printAction: function (items, sActionName) {
            var that = this;
            var promise = new Promise(function (resolve, reject) {
                that._CallODataV2("ACTION", "/processLogic", [], {
                    "Zzkey": items,
                    "Event": sActionName,
                    "UserEmail": that._UserInfo.getEmail() === undefined ? "" : that._UserInfo.getEmail()
                }, {}).then(function (oResponse) {
                    var records = JSON.parse(oResponse.processLogic.Zzkey);
                    resolve(records);
                });
            }).catch((oError) => {
                messages.showError(oError.message);
                reject(oError);
            });
            return promise;
        },

        porcessPrintContent: function (aSelectedItem) {
            var pdfContent = {
                PrintData: {
                    results: []
                }
            };

            var FGPrint = {
                to_Item: {
                    results: []
                }
            };
            FGPrint.to_Item.results = aSelectedItem.map(item => ({
                Plant: item.PLANT,
                Barcode: item.BARCODE,
                Box_Qty: item.BOX_QTY,
                CustomerName: item.CUSTOMERNAME,
                Product: item.PRODUCT,
                ProductName: item.PRODUCTNAME,
                WO_Order: item.WO_ORDER,
                WO_Qty: item.WO_QTY,
                Barcode_Qty: item.BARCODE_QTY,
                History: item.HISTORY,
                PurchaseOrderByCustomer: item.PURCHASEORDERBYCUSTOMER,
                CurrentDate: item.CURRENTDATE,
                Customer_Material: item.CUSTOMER_MATERIAL,
            }));
            pdfContent = {
                PrintData: FGPrint
            };
            return pdfContent;
        },
        getPDF: function (record, pdfContent, sTemplate) {
            var that = this;
            var oBusyDialog = new BusyDialog();
            var aRecordCreated = [];
            var sFileName = _ResourceBundle.getText("appTitle") + this.getCurrentDateTime() + sTemplate;
            var promise = new Promise((resolve, reject) => {
                var createPrintRecord = _oPrintModel.bindContext("/PrintRecord/com.sap.gateway.srvd.zui_prt_record_o4.v0001.createPrintRecord(...)");
                createPrintRecord.setParameter("TemplateID", sTemplate);
                createPrintRecord.setParameter("IsExternalProvidedData", true);
                var oXMLData = json2xml(pdfContent, {
                    compact: true,
                    ignoreComment: true,
                    spaces: 4
                });
                // var pdfData =  btoa(unescape(encodeURIComponent(oXMLData)));
                var pdfData = btoa(unescape(encodeURIComponent("<?xml version=\"1.0\" encoding=\"UTF-8\"?><form>" + oXMLData + "</form>")));
                createPrintRecord.setParameter("ExternalProvidedData", pdfData);
                // var uuidx16 = context.getObject().Uuid.replace(/-/g, '');
                createPrintRecord.setParameter("ProvidedKeys", "");
                createPrintRecord.setParameter("ResultIsActiveEntity", true);
                createPrintRecord.setParameter("FileName", sFileName);
                createPrintRecord.execute("$auto", false, null, /*bReplaceWithRVC*/false).then(() => {
                    resolve(createPrintRecord);
                }).catch((oError) => {
                    reject(oError);
                });
            });
            aRecordCreated.push(promise);

            oBusyDialog.open();
            try {
                Promise.all(aRecordCreated).then((aContext) => {
                    oBusyDialog.close();
                    var sURL;
                    for (const activeContext of aContext) {
                        var boundContext = activeContext.getBoundContext();
                        var object = boundContext.getObject();
                        var sPath = _oPrintModel.getKeyPredicate("/PrintRecord", object);
                        sURL = activeContext.getModel("Print").getServiceUrl() + "PrintRecord" + sPath + '/PDFContent';
                        sap.m.URLHelper.redirect(sURL, true);
                    };
                    that._updatePrintInfo();
                    MessageToast.show("Print Success");
                }).finally(() => {
                    oBusyDialog.close();
                });;
            } catch (error) {
                MessageToast.show(error);
                oBusyDialog.close();
            };
        },
        _updatePrintInfo: function () {
            this.getView().byId("idSmartFilterBar").search();
        },

        onBeforeExport: function (oEvent) {
            var mExcelSettings = oEvent.getParameter("exportSettings");
            var sFileName = this.getModel("i18n").getResourceBundle().getText("appTitle");
            this._exportExcel(mExcelSettings, sFileName);
        },

        _exportExcel: function (mExcelSettings, sFileName) {
            mExcelSettings.workbook.columns.forEach(function (oColumn) {
                switch (oColumn.property) {
                    //  Date
                    case "Actual_Date":
                    case "Print_Date":
                    case "Create_Date":
                    case "Change_Date":
                        oColumn.type = sap.ui.export.EdmType.Date;
                        break;
                }
            });
            mExcelSettings.fileName = sFileName + "_" + this.getCurrentDateTime();
        }
    });
});
