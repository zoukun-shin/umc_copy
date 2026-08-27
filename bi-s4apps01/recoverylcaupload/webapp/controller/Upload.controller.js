/* global XLSX:true */
sap.ui.define([
    "./Base",
    "../model/formatter",
    "../lib/xlsx",
    "sap/m/BusyDialog",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], function (Base, formatter, xlsx, BusyDialog, MessageBox, MessageToast) {
    "use strict";

    return Base.extend("bi.recoverylcaupload.controller.Upload", {

        formatter: formatter,

        onInit() {
            this._BusyDialog = new BusyDialog();
        },

        onFileChange: function (oEvent) {
            var aExcelSet = [];
            var oFile = oEvent.getParameter("files")[0];
            if (!oFile) {
                this.getModel("local").setProperty("/excelSet", []);
                this.getModel("local").setProperty("/logInfo", "");
                return;
            }
            var oReader = new FileReader();
            oReader.readAsArrayBuffer(oFile);
            this._BusyDialog.open();
            oReader.onload = function (e) {
                var oWorkBook = XLSX.read(e.target.result, {
                    type: "binary"
                });
                var oSheet = oWorkBook.Sheets[Object.getOwnPropertyNames(oWorkBook.Sheets)[0]];
                var aSheetData = XLSX.utils.sheet_to_row_object_array(oSheet);
                // read valid data starting from line 7
                for (var i = 5; i < aSheetData.length; i++) {
                    var item = {
                        "Status": "",
                        "Message": "",
                        "Row": i - 4,
                        "YearMonth": aSheetData[i]["YearMonth"] === undefined ? "" : aSheetData[i]["YearMonth"],
                        "RecoveryManagementNumber": aSheetData[i]["RecoveryManagementNumber"] === undefined ? "" : aSheetData[i]["RecoveryManagementNumber"],
                        "PurchaseOrder": aSheetData[i]["PurchaseOrder"] === undefined ? "" : aSheetData[i]["PurchaseOrder"],
                        "PurchaseOrderItem": aSheetData[i]["PurchaseOrderItem"] === undefined ? "" : aSheetData[i]["PurchaseOrderItem"],
                        "InitialMaterial": aSheetData[i]["InitialMaterial"] === undefined ? "" : aSheetData[i]["InitialMaterial"],
                        "InitialMaterialText": aSheetData[i]["InitialMaterialText"] === undefined ? "" : aSheetData[i]["InitialMaterialText"],
                        "RecoveryNecessaryAmount": aSheetData[i]["RecoveryNecessaryAmount"] === undefined ? "" : aSheetData[i]["RecoveryNecessaryAmount"],
                        "CompanyCurrency": aSheetData[i]["Currency"] === undefined ? "" : aSheetData[i]["Currency"]
                    };
                    aExcelSet.push(item);
                }
                this.getModel("local").setProperty("/excelSet", aExcelSet);
                this.getModel("local").setProperty("/logInfo", this.getResourceBundle().getText("logInfo", [aExcelSet.length, 0, 0]));
                this.byId("idFileUploader").clear();
                this._BusyDialog.close();
            }.bind(this);
        },

        onClear: function () {
            this.getModel("local").setProperty("/excelSet", []);
            this.getModel("local").setProperty("/logInfo", "");
        },

        onSave: function () {
            this._callOData("SAVE");
        },

        onExport: function () {
            this._callOData("EXPORT");
        },

        _callOData: function (bEvent) {
            var aPromise = [];
            var sUploadType = "";
            var aExcelSet = this.getModel("local").getProperty("/excelSet");
            var oRequestData = {
                UploadType: "LCA",
                JsonData: aExcelSet
            };
            aPromise.push(this._CallODataV2("ACTION", "/processLogic", [], {
                "Event": bEvent,
                "Zzkey": JSON.stringify(oRequestData),
                "RecordUUID": ""
            }, {}));
            try {
                this._BusyDialog.open();
                Promise.all(aPromise).then((aContext) => {
                    var oResult = {
                        iSuccess: 0,
                        iFailed: 0
                    };
                    this._BusyDialog.close();
                    var aExcelSet = this.getModel("local").getProperty("/excelSet");
                    var object = aContext[0].processLogic;
                    if (bEvent === "EXPORT") {
                        if (object.RecordUUID) {
                            var sURL = this.getModel("Print").getServiceUrl() + "PrintRecord(RecordUUID=" + object.RecordUUID + ",IsActiveEntity=true)/PDFContent";
                            sap.m.URLHelper.redirect(sURL, true);
                        }
                    } else {
                        var oZzkey = JSON.parse(object.Zzkey);
                        oZzkey.JSONDATA.forEach(element => {
                            for (var index = 0; index < aExcelSet.length; index++) {
                                if (aExcelSet[index].Row === element.ROW) {
                                    aExcelSet[index].Status = element.STATUS;
                                    aExcelSet[index].Message = element.MESSAGE;
                                }
                            }
                            if (element.STATUS === 'E') {
                                oResult.iFailed += 1;
                            } else {
                                oResult.iSuccess += 1;
                            }
                        });
                    }
                    this.getModel("local").setProperty("/excelSet", aExcelSet);
                    if (bEvent !== "EXPORT") {
                        this.getModel("local").setProperty("/logInfo", this.getModel("i18n").getResourceBundle().getText("logInfo", [aExcelSet.length, oResult.iSuccess, oResult.iFailed]));
                    }
                    MessageToast.show(this.getModel("i18n").getResourceBundle().getText("ProcessingCompleted"));
                }).catch((error) => {
                    MessageBox.error(error);
                }).finally(() => {
                    this._BusyDialog.close();
                });
            } catch (error) {
                MessageBox.error(error);
                this._BusyDialog.close();
            }
        }
    });
});