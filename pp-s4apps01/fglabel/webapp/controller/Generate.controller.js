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
    return Base.extend("pp.fglabel.controller.Generate", {
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
            console.log("Selected Plant Key:", sKey);
            this.getView().getModel("local").setProperty("/PlantG", sKey);
        },

        handleChange: function (oEvent) {

        },

        onFind1: function (oEvent) {
            var that = this;
            var sPlant = that.getView().getModel("local").getProperty("/PlantG");
            if (!sPlant) {
                MessageBox.error(this.getResourceBundle().getText("msg001"));
                return;
            };

            var sWO_Order = this.byId("idWO_OrderG").getValue();
            if (!sWO_Order) {
                MessageBox.error(this.getResourceBundle().getText("msg002"));
                return;
            };

            that._CallODataV2("ACTION", "/processLogic", [], {
                "Zzkey": "",
                "Event": "FIND1",
                "Plant": sPlant,
                "WO_Order": sWO_Order
            }, {}).then(function (oResponse) {
                var result = JSON.parse(oResponse.processLogic.Zzkey);
                if (result.MSGTYP === 'E') {
                    MessageBox.error(result.MESSAGE);
                    return;
                } else {
                    that._LocalData.setProperty("/tab_modeG", "edit");
                    that._LocalData.setProperty("/headSetG", {
                        Product: result.PRODUCT,
                        Customer: result.CUSTOMER,
                        SalesDocument: result.SALESDOCUMENT,
                        PurchaseOrderByCustomer: result.PURCHASEORDERBYCUSTOMER,
                        WO_Qty: result.WO_QTY,
                        WO_Start_Date: new Date(result.WO_START_DATE),
                    });
                }
                that.getModel().resetChanges();
                that.getModel().refresh();
            }, function (oError) {
                MessageBox.error(oError.message);
            });
        },

        onSave: function (oEvent) {
            var that = this;
            var sGen_Qty = this.byId("idGen_QtyG").getValue();
            var sPacking_Qty = this.byId("idPacking_QtyG").getValue();
            if (!sGen_Qty || !sPacking_Qty) {
                MessageBox.error(this.getResourceBundle().getText("msg003"));
                return;
            };

            MessageBox.confirm(this.getModel("i18n").getResourceBundle().getText("info001"), {
                actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                emphasizedAction: MessageBox.Action.OK,
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        that._BusyDialog.open();
                        var sPlant = that.getView().getModel("local").getProperty("/PlantG");
                        var sWO_Order = that.byId("idWO_OrderG").getValue();
                        var head = that._LocalData.getProperty("/headSetG");
                        var header = {
                            Plant: sPlant,
                            WO_Order: sWO_Order,
                            Product: head.Product,
                            Customer: head.Customer,
                            SalesDocument: head.SalesDocument,
                            PurchaseOrderByCustomer: head.PurchaseOrderByCustomer,
                            WO_QTY: head.WO_Qty,
                            WO_Start_Date: head.WO_Start_Date,
                            Gen_Qty: head.Gen_Qty,
                            Packing_Qty: head.Packing_Qty,
                            History: head.History,
                            Actual_Date: new Date(head.Actual_Date),
                            UserEmail: that._UserInfo.getEmail() === undefined ? "" : that._UserInfo.getEmail(),
                        };
                        that._CallODataV2("ACTION", "/processLogic", [], {
                            "Zzkey": JSON.stringify(header),
                            "Event": "SAVE",
                        }, {}).then(function (oResponse) {
                            var result = JSON.parse(oResponse.processLogic.Zzkey);
                            var items = that._LocalData.getProperty("/itemSetG") || [];
                            result.ITEMS.forEach(element => {
                                items.push({
                                    Plant: element.PLANT,
                                    Barcode_Text: element.BARCODE_TEXT,
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
                                })
                            });
                            items.forEach(function (oItem, index) {
                                oItem.ItemNo = String(index + 1);
                            });
                            that._LocalData.setProperty("/itemSetG", items);
                            that._LocalData.refresh(true);
                            that._BusyDialog.close();
                        }, function (oError) {
                            MessageBox.error(oError.message);
                        });
                    }
                },
            });
        },
        onClear: function (oEvent) {
            this._LocalData.setProperty("/headSetG", "");
            this._LocalData.setProperty("/WO_OrderG", "");
        },
        
        onPrintEN: function (oEvent) {
            var that = this;
            _ResourceBundle = this.getModel("i18n").getResourceBundle();
            _oPrintModel = this.getModel("Print");
            var aItems = this.getModel("local").getProperty("/itemSetG");
            _oFunctions.onCustomAction(aItems, "PRINTEN");
        },

        onPrintVN: function (oEvent) {
            var that = this;
            _ResourceBundle = this.getModel("i18n").getResourceBundle();
            _oPrintModel = this.getModel("Print");
            var aItems = this.getModel("local").getProperty("/itemSetG");
            _oFunctions.onCustomAction(aItems, "PRINTVN");
        },

        onCustomAction: function (aSelectedContexts, sActionName) {
            var aPromise = [];
            aPromise.push(_oFunctions.printAction(aSelectedContexts, sActionName));
            Promise.all(aPromise).then(function (records) {
                records.forEach(record => {
                    var pdfContent = _oFunctions.porcessPrintContent(record);
                    _oFunctions.getPDF(pdfContent, sActionName);
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
            }));
            pdfContent = {
                PrintData: FGPrint
            };
            return pdfContent;
        },
        getPDF: function (pdfContent, sActionName) {
            var that = this;
            if (sActionName === "PRINTEN"){
                var sTempalte = "YY1_FGPRT_EN";
            }else {
                var sTempalte = "YY1_FGPRT_VN";
            };
            var oBusyDialog = new BusyDialog();
            var aRecordCreated = [];
            var sFileName = _ResourceBundle.getText("appTitle") + new Date().getTime();
            var promise = new Promise((resolve, reject) => {
                var createPrintRecord = _oPrintModel.bindContext("/PrintRecord/com.sap.gateway.srvd.zui_prt_record_o4.v0001.createPrintRecord(...)");
                createPrintRecord.setParameter("TemplateID", sTempalte);
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
                    MessageToast.show("Print Success");
                }).finally(() => {
                    oBusyDialog.close();
                });;
            } catch (error) {
                MessageToast.show(error);
                oBusyDialog.close();
            }
        },
    });
});
