sap.ui.define([
    "./Base",
    "../model/formatter",
    "sap/m/BusyDialog",
    "sap/m/Button",
    "sap/m/Dialog",
    "sap/m/Input",
    "sap/m/Label",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/m/VBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/export/Spreadsheet",
    "../lib/xml-js",
], (Base, formatter, BusyDialog, Button, Dialog, Input, Label, MessageBox, MessageToast, VBox, Filter, FilterOperator, Spreadsheet, xml) => {
    "use strict";
    var _oFunctions, _ResourceBundle, _oPrintModel;
    return Base.extend("mm.returnmatpackprint.controller.Main", {
        formatter: formatter,
        onInit: function () {
            _oFunctions = this;
            this._UserInfo = sap.ushell.Container.getService("UserInfo");
            this.getRouter().getRoute("Main").attachMatched(this._initialize, this);
        },

        _initialize: function () {
            var sUser = this._UserInfo.getFullName() === undefined ? "" : this._UserInfo.getFullName();
            var sEmail = this._UserInfo.getEmail() === undefined ? "" : this._UserInfo.getEmail();
            var oContextBinding = this.getView().getModel("Authority").bindContext("/User(Mail='" + sEmail + "',IsActiveEntity=true)", undefined, {
                "$expand": "_AssignPlant,_AssignCompany,_AssignSalesOrg,_AssignPurchOrg,_AssignRole($expand=_UserRoleAccessBtn)"
            });
            oContextBinding.requestObject().then(function (context) {
                var aAccessBtns = [],
                    aAllAccessBtns = [];
                if (context._AssignRole && context._AssignRole.length > 0) {
                    context._AssignRole.forEach(role => {
                        aAccessBtns.push(role._UserRoleAccessBtn);
                    });
                    aAllAccessBtns = aAccessBtns.flat();
                }
                if (!aAllAccessBtns.some(btn => btn.AccessId === "returnmatpackprint-View")) {
                    if (!this.oErrorMessageDialog) {
                        this.oErrorMessageDialog = new sap.m.Dialog({
                            type: sap.m.DialogType.Message,
                            state: "Error",
                            content: new sap.m.Text({
                                text: this.getView().getModel("i18n").getResourceBundle().getText("noAuthorityView", [sUser])
                            })
                        });
                    }
                    this.getView().destroy();
                    this.oErrorMessageDialog.open();
                }
                this.getOwnerComponent().getModel("local").setProperty("/authorityCheck", {
                    button: {
                        View: aAllAccessBtns.some(btn => btn.AccessId === "returnmatpackprint-View"),
                        Print: aAllAccessBtns.some(btn => btn.AccessId === "returnmatpackprint-Print"),
                    },
                    data: {
                        PlantSet: context._AssignPlant,
                        CompanySet: context._AssignCompany,
                        SalesOrgSet: context._AssignSalesOrg,
                        PurchOrgSet: context._AssignPurchOrg,
                        RoleSet: context._AssignRole
                    }
                });
            }.bind(this), function (oError) {
                if (!this.oErrorMessageDialog) {
                    this.oErrorMessageDialog = new sap.m.Dialog({
                        type: sap.m.DialogType.Message,
                        state: "Error",
                        content: new sap.m.Text({
                            text: this.getView().getModel("i18n").getResourceBundle().getText("getAuthorityFailed")
                        })
                    });
                }
                this.getView().destroy();
                this.oErrorMessageDialog.open();
            }.bind(this));
        },

        onBeforeRebindTable: function (oEvent) {
        },

        preparePostBody: function (oPrintInputValues) {
            var listItems = this.byId("idMultiSelectionPlugin").getSelectedIndices();
            if (!listItems.length) {
                return Promise.reject(new Error(this.getModel("i18n").getResourceBundle().getText("selectPrintRowFirst")));
            }

            var that = this;
            var aSelectedRows = [];

            // Collect all selected items
            listItems.forEach(function (iIndex) {
                var sPath = that.byId("ReportTable").getContextByIndex(iIndex).getPath();
                var oSelectedRow = that.getModel().getObject(sPath);
                if (oSelectedRow) {
                    var oRow = Object.assign({}, oSelectedRow);
                    delete oRow.__metadata;
                    oRow.FILENO = oPrintInputValues ? oPrintInputValues.FILENO : "";
                    oRow.DCMTNO = oPrintInputValues ? oPrintInputValues.DCMTNO : "";
                    oRow.MEMO = oPrintInputValues ? oPrintInputValues.MEMO : "";
                    aSelectedRows.push(oRow);
                }
            });

            if (aSelectedRows.length === 0) {
                return Promise.reject(new Error(this.getModel("i18n").getResourceBundle().getText("selectPrintRowFirst")));
            }

            // Send all selected rows to backend in one request
            return Promise.resolve([JSON.stringify(aSelectedRows)]);
        },

        onPrint: function (oEvent) {
            this._openPrintInputDialog();
        },

        _openPrintInputDialog: function () {
            var oBundle = this.getModel("i18n").getResourceBundle();
            var oFileNoInput = new Input({
                width: "100%"
            });
            var oDcmtNoInput = new Input({
                width: "100%"
            });
            var oMemoInput = new Input({
                width: "100%"
            });

            var oDialog = new Dialog({
                title: oBundle.getText("printDialogTitle"),
                contentWidth: "26rem",
                content: new VBox({
                    width: "100%",
                    items: [
                        new Label({
                            text: oBundle.getText("FILENO")
                        }),
                        oFileNoInput,
                        new Label({
                            text: oBundle.getText("DCMTNO")
                        }),
                        oDcmtNoInput,
                        new Label({
                            text: oBundle.getText("MEMO")
                        }),
                        oMemoInput
                    ]
                }),
                beginButton: new Button({
                    text: oBundle.getText("printDialogOk"),
                    type: "Emphasized",
                    press: function () {
                        var oPrintInputValues = {
                            FILENO: oFileNoInput.getValue().trim(),
                            DCMTNO: oDcmtNoInput.getValue().trim(),
                            MEMO: oMemoInput.getValue().trim()
                        };

                        oDialog.close();
                        _ResourceBundle = this.getModel("i18n").getResourceBundle();
                        _oPrintModel = this.getModel("Print");
                        this.preparePostBody(oPrintInputValues).then(function (aItems) {
                            _oFunctions.onCustomAction(aItems, "PRINT", "YY1_MM065");
                        }).catch(function (oError) {
                            MessageBox.error(oError.message || oError);
                        });
                    }.bind(this)
                }),
                endButton: new Button({
                    text: oBundle.getText("printDialogCancel"),
                    press: function () {
                        oDialog.close();
                    }
                }),
                afterClose: function () {
                    oDialog.destroy();
                }
            });

            oDialog.open();
        },

        onCustomAction: function (aSelectedContexts, sActionName , sTemplate) {
            var oBusyDialog = new BusyDialog();
            oBusyDialog.open();

            // aSelectedContexts is an array with one element (the stringified JSON from preparePostBody)
            _oFunctions.printAction(aSelectedContexts, sActionName)
                .then(function (records) {
                    // Group records by RTNO (Return Material Number)
                    var mRTNumbers = {};
                    records.forEach(function(record) {
                        if (!mRTNumbers[record.RTNO]) {
                            mRTNumbers[record.RTNO] = [];
                        }
                        mRTNumbers[record.RTNO].push(record);
                    });

                    // Create PDF for each RTNO group
                    var aPromises = [];
                    Object.keys(mRTNumbers).forEach(function(sRTNO) {
                        var aGroupedRecords = mRTNumbers[sRTNO];
                        var pdfContent = _oFunctions.porcessPrintContent(aGroupedRecords);
                        var promise = _oFunctions.getPDF(aGroupedRecords, pdfContent, sTemplate);
                        aPromises.push(promise);
                    });

                    return Promise.all(aPromises);
                })
                .then(function() {
                    oBusyDialog.close();
                    MessageToast.show("All prints completed successfully");
                    _oFunctions._updatePrintInfo();
                })
                .catch(function(oError) {
                    oBusyDialog.close();
                    MessageBox.error(oError.message || oError);
                });
        },

        printAction: function (items, sActionName) {
            var that = this;
            var promise = new Promise(function (resolve, reject) {
                that._CallODataV2("ACTION", "/processLogic", [], {
                    "Zzkey": items,
                    "Event": sActionName,
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

        porcessPrintContent: function (aItems) {

            var pdfContent = {
                PrintData: {
                    results: []
                }
            };
            var RetPrint = {
                Title:aItems[0].TITLE,
                FileInfo:aItems[0].FILEINFO,
                DepartDate:aItems[0].DEPARTDATE,
                CarNo:aItems[0].CARNO,
                Customer:aItems[0].CUSTOMER,
                Conveyance:aItems[0].CONVEYANCE,
                HkLocal:aItems[0].HKLOCAL,
                Delivery:aItems[0].DELIVERY,
                Total:aItems[0].TOTAL,
                to_Items: {
                    results: []
                }
            };

            aItems.forEach(function(item) {
                RetPrint.to_Items.results.push({
                    Number: item.NUMBER,
                    RtNo: item.RTNO,
                    PartNo: item.PARTNO,
                    Description: item.DESCRIPTION,
                    Quantity: item.QUANTITY,
                    BoxNo: item.BOXNO,
                    BoxQty: item.BOXQTY,
                    PoNo: item.PONO,
                    Weight: item.WEIGHT,
                    Gross: item.GROSS,
                });
            });

            pdfContent = {
                PrintData: RetPrint
            };
            return pdfContent;
        },
        getPDF: function (record, pdfContent, sTemplate) {
            var that = this;
            var sFileName = _ResourceBundle.getText("appTitle") + "_" + this.getCurrentDateTime();
            
            return new Promise((resolve, reject) => {
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
                    var boundContext = createPrintRecord.getBoundContext();
                    var object = boundContext.getObject();
                    var sPath = _oPrintModel.getKeyPredicate("/PrintRecord", object);
                    var sURL = createPrintRecord.getModel("Print").getServiceUrl() + "PrintRecord" + sPath + '/PDFContent';
                    sap.m.URLHelper.redirect(sURL, true);
                    resolve();
                }).catch((oError) => {
                    reject(oError);
                });
            });
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
