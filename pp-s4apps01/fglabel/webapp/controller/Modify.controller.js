sap.ui.define([
    "./Base",
    "./ValueHelpDialog",
    "../model/formatter",
    "sap/m/BusyDialog",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/Fragment",
    "sap/ui/export/Spreadsheet",
    "../lib/xml-js",
], (Base, ValueHelpDialog, formatter, BusyDialog, MessageBox, MessageToast, Filter, FilterOperator, Fragment, Spreadsheet, xml) => {
    "use strict";
    var _oFunctions, _ResourceBundle, _oPrintModel;
    return Base.extend("pp.fglabel.controller.Modify", {
        ValueHelpDialog: ValueHelpDialog,
        formatter: formatter,

        onInit() {
            _oFunctions = this;
            this._LocalData = this.getOwnerComponent().getModel("local");
            this._oDataModel = this.getOwnerComponent().getModel();
            this._oDataModel.setRefreshAfterChange(false);
            this._BusyDialog = new BusyDialog();
            if (sap.ushell && sap.ushell.Container) {
                this._UserInfo = sap.ushell.Container.getService("UserInfo").getUser();
            };
        },

        onPlantSelectionChange: function (oEvent) {
            const oCombo = oEvent.getSource();
            const sKey = oCombo.getSelectedKey();
            this.getView().getModel("local").setProperty("/Plant", sKey);
        },

        onRefresh: function (oEvent) {
            var that = this;
            var sPlant = that.getView().getModel("local").getProperty("/Plant");
            if (!sPlant) {
                MessageBox.error(this.getResourceBundle().getText("msg001"));
                return;
            };
            var sBarcode = this.byId("idBarcode").getValue();
            if (!sBarcode) {
                MessageBox.error(this.getResourceBundle().getText("msg007"));
                return;
            };
            that._LocalData.setProperty("/headSet", "");
            that._LocalData.setProperty("/itemSetM", []);
            MessageBox.confirm(this.getModel("i18n").getResourceBundle().getText("info005"), {
                actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                emphasizedAction: MessageBox.Action.OK,
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        that._BusyDialog.open();
                        that._CallODataV2("ACTION", "/processLogic", [], {
                            "Zzkey": "",
                            "Event": "REFRESH",
                            "Plant": sPlant,
                            "Barcode": sBarcode,
                            UserEmail: that._UserInfo.getEmail() === undefined ? "" : that._UserInfo.getEmail(),
                        }, {}).then(function (oResponse) {
                            var result = JSON.parse(oResponse.processLogic.Zzkey);
                            that._LocalData.setProperty("/headSet", {
                                Barcode: result.BARCODE,
                                Barcode_Qty: result.BARCODE_QTY,
                                WO_Order: result.WO_ORDER,
                                Product: result.PRODUCT,
                                Customer: result.CUSTOMER,
                                SalesDocument: result.SALESDOCUMENT,
                                PurchaseOrderByCustomer: result.PURCHASEORDERBYCUSTOMER,
                                WO_Qty: result.WO_QTY,
                                WO_Start_Date: new Date(result.WO_START_DATE),
                                Gen_Qty: result.GEN_QTY,
                                Packing_Qty: result.PACKING_QTY,
                                History: result.HISTORY,
                                Actual_Date: new Date(result.ACTUAL_DATE),
                            });
                            var items = that._LocalData.getProperty("/itemSetM") || [];
                            result.ITEMS.forEach(element => {
                                items.push({
                                    Plant: element.PLANT,
                                    Barcode: element.BARCODE,
                                    Product: element.PRODUCT,
                                    ProductName: element.PRODUCTNAME,
                                    WO_Order: element.WO_ORDER,
                                    WO_Qty: element.WO_QTY,
                                    Gen_Qty: element.GEN_QTY,
                                    Packing_Qty: element.PACKING_QTY,
                                    Box_Qty_Sum: element.BOX_QTY_SUM,
                                    Barcode_Qty: element.BARCODE_QTY,
                                    Father_Barcode: element.FATHER_BARCODE,
                                    Customer: element.CUSTOMER,
                                    CustomerName: element.CUSTOMERNAME,
                                    SalesDocument: element.SALESDOCUMENT,
                                    PurchaseOrderByCustomer: element.PURCHASEORDERBYCUSTOMER,
                                    OldMaterial: element.OLDMATERIAL,
                                    CustomerMaterial: element.CUSTOMERMATERIAL,
                                    ModelName: element.MODELNAME,
                                    WO_Start_Date: element.WO_START_DATE,
                                    WO_Unit: element.WO_UNIT,
                                    WO_Sloc: element.WO_SLOC,
                                    Base_Unit: element.BASE_UNIT,
                                    History: element.HISTORY,
                                    Actual_Date: element.ACTUAL_DATE,
                                    Delete_Flag: element.DELETE_FLAG,
                                    Print_Count: element.PRINT_COUNT,
                                    Print_Date: element.PRINT_DATE,
                                    Print_Time: element.PRINT_TIME,
                                    Print_User: element.PRINT_USER,
                                    Create_Date: element.CREATE_DATE,
                                    Create_Time: element.CREATE_TIME,
                                    Create_User: element.CREATE_USER,
                                    Change_Date: element.CHANGE_DATE,
                                    Change_Time: element.CHANGE_TIME,
                                    Change_User: element.CHANGE_USER,
                                })
                            });
                            if (items) {
                                items.forEach(function (oItem, index) {
                                    oItem.ItemNo = String(index + 1);
                                });
                                that._LocalData.setProperty("/itemSetM", items);
                            };
                            that.getModel().resetChanges();
                            that.getModel().refresh(true);
                            that._BusyDialog.close();
                        }, function (oError) {
                            MessageBox.error(oError.message);
                        });
                    }
                },
            });
        },

        onFind2: function (oEvent) {
            var that = this;
            var sPlant = that.getView().getModel("local").getProperty("/Plant");
            if (!sPlant) {
                MessageBox.error(this.getResourceBundle().getText("msg001"));
                return;
            };

            var sBarcode = this.byId("idBarcode").getValue();
            if (!sBarcode) {
                MessageBox.error(this.getResourceBundle().getText("msg007"));
                return;
            };

            that._CallODataV2("ACTION", "/processLogic", [], {
                "Zzkey": "",
                "Event": "FIND2",
                "Plant": sPlant,
                "Barcode": sBarcode
            }, {}).then(function (oResponse) {
                var result = JSON.parse(oResponse.processLogic.Zzkey);
                if (result.MSGTYP === 'E') {
                    MessageBox.error(result.MESSAGE);
                    return;
                } else {
                    that._LocalData.setProperty("/tab_mode", "edit");
                    that._LocalData.setProperty("/headSet", {
                        Barcode: result.BARCODE,
                        Barcode_Qty: result.BARCODE_QTY,
                        WO_Order: result.WO_ORDER,
                        Product: result.PRODUCT,
                        Customer: result.CUSTOMER,
                        SalesDocument: result.SALESDOCUMENT,
                        PurchaseOrderByCustomer: result.PURCHASEORDERBYCUSTOMER,
                        WO_Qty: result.WO_QTY,
                        WO_Start_Date: new Date(result.WO_START_DATE),
                        Gen_Qty: result.GEN_QTY,
                        Packing_Qty: result.PACKING_QTY,
                        History: result.HISTORY,
                        Actual_Date: new Date(result.ACTUAL_DATE),
                    });
                }
                that.getModel().resetChanges();
                that.getModel().refresh();
            }, function (oError) {
                MessageBox.error(oError.message);
            });
        },

        onSplit1: function (oEvent) {
            var that = this;
            var sNew_Qty = this.byId("idNew_Qty").getValue();
            var sBarcode_Qty = this.byId("idBarcode_Qty").getValue();
            if (!sNew_Qty) {
                MessageBox.error(this.getResourceBundle().getText("msg008"));
                return;
            };
            if (parseFloat(sNew_Qty) >= parseFloat(sBarcode_Qty)) {
                MessageBox.error(this.getResourceBundle().getText("msg009"));
                return;
            };
            that._LocalData.setProperty("/headSet", "");
            that._LocalData.setProperty("/itemSetM", []);
            MessageBox.confirm(this.getModel("i18n").getResourceBundle().getText("info004"), {
                actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                emphasizedAction: MessageBox.Action.OK,
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        that._BusyDialog.open();
                        var sPlant = that.getView().getModel("local").getProperty("/Plant");
                        var sBarcode = that.byId("idBarcode").getValue();
                        var header = {
                            Plant: sPlant,
                            Barcode: sBarcode,
                            New_Qty: sNew_Qty,
                            UserEmail: that._UserInfo.getEmail() === undefined ? "" : that._UserInfo.getEmail(),
                        };
                        that._CallODataV2("ACTION", "/processLogic", [], {
                            "Zzkey": JSON.stringify(header),
                            "Event": "SPLIT1"
                        }, {}).then(function (oResponse) {
                            var result = JSON.parse(oResponse.processLogic.Zzkey);
                            if (result.MSGTYP === 'E') {
                                MessageBox.error(result.MSG);
                            } else {
                                var items = that._LocalData.getProperty("/itemSetM") || [];
                                result.ITEMS.forEach(element => {
                                    items.push({
                                        Plant: element.PLANT,
                                        Barcode: element.BARCODE,
                                        Father_Barcode: element.FATHER_BARCODE,
                                        Product: element.PRODUCT,
                                        ProductName: element.PRODUCTNAME,
                                        WO_Order: element.WO_ORDER,
                                        WO_Qty: element.WO_QTY,
                                        Gen_Qty: element.GEN_QTY,
                                        Packing_Qty: element.PACKING_QTY,
                                        Box_Qty_Sum: element.BOX_QTY_SUM,
                                        Barcode_Qty: element.BARCODE_QTY,
                                        Customer: element.CUSTOMER,
                                        CustomerName: element.CUSTOMERNAME,
                                        SalesDocument: element.SALESDOCUMENT,
                                        PurchaseOrderByCustomer: element.PURCHASEORDERBYCUSTOMER,
                                        OldMaterial: element.OLDMATERIAL,
                                        CustomerMaterial: element.CUSTOMERMATERIAL,
                                        ModelName: element.MODELNAME,
                                        WO_Start_Date: element.WO_START_DATE,
                                        WO_Unit: element.WO_UNIT,
                                        WO_Sloc: element.WO_SLOC,
                                        Base_Unit: element.BASE_UNIT,
                                        History: element.HISTORY,
                                        Actual_Date: element.ACTUAL_DATE,
                                        Delete_Flag: element.DELETE_FLAG,
                                        Create_Date: element.CREATE_DATE,
                                        Create_Time: element.CREATE_TIME,
                                        Create_User: element.CREATE_USER,
                                        Change_Date: element.CHANGE_DATE,
                                        Change_Time: element.CHANGE_TIME,
                                        Change_User: element.CHANGE_USER,
                                    })
                                });
                                items.forEach(function (oItem, index) {
                                    oItem.ItemNo = String(index + 1);
                                });
                                that._LocalData.setProperty("/itemSetM", items);
                            }
                            that.getModel().resetChanges();
                            that.getModel().refresh();
                            that._BusyDialog.close();
                        }, function (oError) {
                            MessageBox.error(oError.message);
                        });
                    }
                },
            });
        },

        onSplit2: function (oEvent) {
            var that = this;
            var sNew_Qty = this.byId("idNew_Qty").getValue();
            var sBarcode_Qty = this.byId("idBarcode_Qty").getValue();
            if (!sNew_Qty) {
                MessageBox.error(this.getResourceBundle().getText("msg008"));
                return;
            };
            if (parseFloat(sNew_Qty) >= parseFloat(sBarcode_Qty)) {
                MessageBox.error(this.getResourceBundle().getText("msg009"));
                return;
            };
            that._LocalData.setProperty("/headSet", "");
            that._LocalData.setProperty("/itemSetM", []);
            MessageBox.confirm(this.getModel("i18n").getResourceBundle().getText("info004"), {
                actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                emphasizedAction: MessageBox.Action.OK,
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        that._BusyDialog.open();
                        var sPlant = that.getView().getModel("local").getProperty("/Plant");
                        var sBarcode = that.byId("idBarcode").getValue();
                        var header = {
                            Plant: sPlant,
                            Barcode: sBarcode,
                            New_Qty: sNew_Qty,
                            UserEmail: that._UserInfo.getEmail() === undefined ? "" : that._UserInfo.getEmail(),
                        };
                        that._CallODataV2("ACTION", "/processLogic", [], {
                            "Zzkey": JSON.stringify(header),
                            "Event": "SPLIT2"
                        }, {}).then(function (oResponse) {
                            var result = JSON.parse(oResponse.processLogic.Zzkey);
                            if (result.MSGTYP === 'E') {
                                MessageBox.error(result.MSG);
                            } else {
                                var items = that._LocalData.getProperty("/itemSetM") || [];
                                result.ITEMS.forEach(element => {
                                    items.push({
                                        Plant: element.PLANT,
                                        Barcode: element.BARCODE,
                                        Father_Barcode: element.FATHER_BARCODE,
                                        Product: element.PRODUCT,
                                        ProductName: element.PRODUCTNAME,
                                        WO_Order: element.WO_ORDER,
                                        WO_Qty: element.WO_QTY,
                                        Gen_Qty: element.GEN_QTY,
                                        Packing_Qty: element.PACKING_QTY,
                                        Box_Qty_Sum: element.BOX_QTY_SUM,
                                        Barcode_Qty: element.BARCODE_QTY,
                                        Customer: element.CUSTOMER,
                                        CustomerName: element.CUSTOMERNAME,
                                        SalesDocument: element.SALESDOCUMENT,
                                        PurchaseOrderByCustomer: element.PURCHASEORDERBYCUSTOMER,
                                        OldMaterial: element.OLDMATERIAL,
                                        CustomerMaterial: element.CUSTOMERMATERIAL,
                                        ModelName: element.MODELNAME,
                                        WO_Start_Date: element.WO_START_DATE,
                                        WO_Unit: element.WO_UNIT,
                                        WO_Sloc: element.WO_SLOC,
                                        Base_Unit: element.BASE_UNIT,
                                        History: element.HISTORY,
                                        Actual_Date: element.ACTUAL_DATE,
                                        Delete_Flag: element.DELETE_FLAG,
                                        Create_Date: element.CREATE_DATE,
                                        Create_Time: element.CREATE_TIME,
                                        Create_User: element.CREATE_USER,
                                        Change_Date: element.CHANGE_DATE,
                                        Change_Time: element.CHANGE_TIME,
                                        Change_User: element.CHANGE_USER,
                                    })
                                });
                                items.forEach(function (oItem, index) {
                                    oItem.ItemNo = String(index + 1);
                                });
                                that._LocalData.setProperty("/itemSetM", items);
                            }
                            that.getModel().resetChanges();
                            that.getModel().refresh();
                            that._BusyDialog.close();
                        }, function (oError) {
                            MessageBox.error(oError.message);
                        });
                    }
                },
            });
        },

        onClear: function (oEvent) {
            this._LocalData.setProperty("/headSet", "");
            this._LocalData.setProperty("/Barcode", "");
            this._LocalData.setProperty("/New_Qty", "");
            this._LocalData.setProperty("/itemSetM", []);
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

        preparePostBody: function () {
            var listItems = this.byId("idModifyTable").getSelectedIndices();
            var items = this._LocalData.getProperty("/itemSetM");
            var selectedRows = [];
            listItems.forEach((item) => {
                var oRow = items[item];
                selectedRows.push(oRow);
            });
            return selectedRows;
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
                    "Zzkey": JSON.stringify(items),
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
                    }
                    that._updatePrintInfo(record);
                    MessageToast.show("Print Success");
                }).finally(() => {
                    oBusyDialog.close();
                });
            } catch (error) {
                MessageToast.show(error);
                oBusyDialog.close();
            }
        },
        _updatePrintInfo: function (record) {
            var aRows = this._LocalData.getProperty("/itemSetM");
            record.forEach(oRecord => {
                let oRow = aRows.find(o =>
                    o.Plant === oRecord.PLANT &&
                    o.Barcode === oRecord.BARCODE
                );

                if (oRow) {
                    oRow.Print_Count = oRecord.PRINT_COUNT; 
                    oRow.Print_Date = oRecord.PRINT_DATE;
                    oRow.Print_Time = oRecord.PRINT_TIME;
                    oRow.Print_User = oRecord.PRINT_USER;
                }
            });
            this._LocalData.setProperty("/itemSetM", aRows);
            this.getModel().resetChanges();
            this.getModel().refresh(true);
        }
    });
});
