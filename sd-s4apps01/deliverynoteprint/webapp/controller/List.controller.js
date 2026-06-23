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
    return Base.extend("sd.deliverynoteprint.controller.List", {
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

            // 根据选择框，添加过滤条件传值到后端
            var filters = oEvent.getParameters().bindingParams.filters;
            if (!filters) {
                filters = [];
            }

            var sDisplayStockQty = this.byId("idCB1").getSelected();

            if (sDisplayStockQty === true) {
                var oIndicator1Filter = new sap.ui.model.Filter({
                    path: "PartsShipping",
                    operator: "EQ",
                    value1: sDisplayStockQty
                });
                filters.push(oIndicator1Filter);
            }
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

        onPrintNM: function (oEvent) {
            var that = this;
            _ResourceBundle = this.getModel("i18n").getResourceBundle();
            _oPrintModel = this.getModel("Print");
            var aItems = this.preparePostBody();
            _oFunctions.onCustomAction(aItems, "PRINTNM", "YY1_SD051_NM");
        },

        onPrintFJ: function (oEvent) {
            var that = this;
            _ResourceBundle = this.getModel("i18n").getResourceBundle();
            _oPrintModel = this.getModel("Print");
            var aItems = this.preparePostBody();
            _oFunctions.onCustomAction(aItems, "PRINTFJ", "YY1_SD051_FJ");
        },

        onPrintQT: function (oEvent) {
            var that = this;
            _ResourceBundle = this.getModel("i18n").getResourceBundle();
            _oPrintModel = this.getModel("Print");
            var aItems = this.preparePostBody();
            _oFunctions.onCustomAction(aItems, "PRINTQT" ,"YY1_SD051_QT");
        },

        onCustomAction: function (aSelectedContexts, sActionName , sTemplate) {
            _oFunctions.printAction(aSelectedContexts, sActionName , sTemplate)
                .then(function (records) {
                    const pdfContent = _oFunctions.porcessPrintContent(records);
                    _oFunctions.getPDF(records, pdfContent, sTemplate);
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

        porcessPrintContent: function (aItems) {

            var pdfContent = {
                PrintData: {
                    results: []
                }
            };
            var Print = {
                Title:aItems[0].TITLE,
                Customer:aItems[0].CUSTOMER,
                Depart:aItems[0].DEPART,
                Destination:aItems[0].DESTINATION,
                Tono:aItems[0].TONO,
                Fileno:aItems[0].FILENO,
                Total1:aItems[0].TOTAL1,
                Total2:aItems[0].TOTAL2,
                Delicompany:aItems[0].DELICOMPANY,
                to_Item: {
                    results: []
                }
            };

            aItems.forEach(function(item) {
                Print.to_Item.results.push({
                    Pono: item.PONO,
                    Sono: item.SONO,
                    Dnno: item.DNNO,
                    Partno: item.PARTNO,
                    Custno: item.CUSTNO,
                    QtyCtn: item.QTYCTN,
                    CtnQty: item.CTNQTY,
                    Qty: item.QTY,
                    Remark: item.REMARK,
                    //for QT
                    Description: item.DESCRIPTION,
                    Mttype: item.MTTYPE,
                    Wwdeliqty: item.WWDELIQTY,
                    Pwg: item.PWG,
                    Gwkg: item.GWKG,
                    Prddate: item.PRDDATE,
                    //for FJ
                    Model: item.MODEL,
                    Place: item.PLACE   
                });
            });

            pdfContent = {
                PrintData: Print
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
