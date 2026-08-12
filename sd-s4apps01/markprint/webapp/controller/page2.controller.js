sap.ui.define([
    "./Base",
    "sap/ui/core/mvc/Controller",
    "../model/formatter",
    "./messages",
    "../util/xlsx",
    "sap/m/BusyDialog",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/export/Spreadsheet"
], function (
    Base,
    Controller,
    formatter,
    messages,
    xlsx,
    BusyDialog,
    MessageBox,
    MessageToast,
    Spreadsheet
) {
    "use strict";

    return Base.extend("sd.markprint.controller.page2", {
        formatter: formatter,
        onInit: function () {
            this._LocalData = this.getOwnerComponent().getModel("local");
            this._oDataModel = this.getOwnerComponent().getModel();
            this._ResourceBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
            this._BusyDialog = new BusyDialog();
            this._UserInfo = sap.ushell.Container.getService("UserInfo");
            this.getRouter().getRoute("Main").attachMatched(this._initialize, this);
        },

        _initialize: function () {
            var sLanguage = sap.ui.getCore().getConfiguration().getLanguage().substring(0, 2).toUpperCase();
            var oFilter = new sap.ui.model.Filter("Object", sap.ui.model.FilterOperator.EQ, "ZUPLOAD_CUSTMAT_" + sLanguage);
            var oControlBinding = this.byId("idTemplateCollection").getBinding("items");
            oControlBinding.filter(oFilter);
        },

        getMediaUrl: function (sUrlString) {
            if (sUrlString) {
                var sUrl = new URL(sUrlString);
                var iStart = sUrl.href.indexOf(sUrl.origin);
                var sPath = sUrl.href.substring(iStart + sUrl.origin.length, sUrl.href.length);
                //return "/S4" + sPath;
                return jQuery.sap.getModulePath("sd.markprint") + sPath;
            } else {
                return "";
            }
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
                // read valid data starting from line 14
                for (var i = 3; i < aSheetData.length; i++) {
                    var item = {
                        "Status": "",
                        "Message": "",
                        "Row": i - 2,
                        "SALESORGANIZATION": aSheetData[i]["SALESORGANIZATION"] === undefined ? "" : aSheetData[i]["SALESORGANIZATION"],
                        "DISTRIBUTIONCHANNEL": aSheetData[i]["DISTRIBUTIONCHANNEL"] === undefined ? "" : aSheetData[i]["DISTRIBUTIONCHANNEL"],
                        "Customer": aSheetData[i]["Customer"] === undefined ? "" : aSheetData[i]["Customer"],
                        "Product": aSheetData[i]["Product"] === undefined ? "" : aSheetData[i]["Product"],
                        "MATERIALBYCUSTOMER": aSheetData[i]["MATERIALBYCUSTOMER"] === undefined ? "" : aSheetData[i]["MATERIALBYCUSTOMER"],
                        "AdditionalCustomerMaterial": aSheetData[i]["AdditionalCustomerMaterial"] === undefined ? "" : aSheetData[i]["AdditionalCustomerMaterial"],
                        "AdditionalCustomerMaterialText": aSheetData[i]["AdditionalCustomerMaterialText"] === undefined ? "" : aSheetData[i]["AdditionalCustomerMaterialText"],
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

        onCheck: function () {
            this._callOData("CHECK");
        },

        onExcute: function () {
            //this._callOData("EXCUTE");
            this._callOData("EXCUTE");
        },

        // onExport: function () {
        //     this._callOData("EXPORT");
        // },

        _callOData: function (bEvent) {
            var aExcelSet = this.getModel("local").getProperty("/excelSet");
            var aPromise = [this._callODataAction(bEvent, aExcelSet)];

            try {
                this._BusyDialog.open();
                Promise.all(aPromise).then((aContext) => {
                    var oResult = {
                        iSuccess: 0,
                        iFailed: 0
                    };
                    this._BusyDialog.close();
                    var aExcelSet = this.getModel("local").getProperty("/excelSet");
                    for (const aRecords of aContext) {
                        aRecords.forEach(element => {
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
                    this.getModel("local").setProperty("/logInfo", this.getModel("i18n").getResourceBundle().getText("logInfo", [aExcelSet.length, oResult.iSuccess, oResult.iFailed]));
                    MessageToast.show(this.getModel("i18n").getResourceBundle().getText("ProcessingCompleted"));
                    if (bEvent === "EXCUTE") {
                        // this.onExport(); // Automatically export after execution
                    }
                }).catch((error) => {
                    MessageBox.error(error);
                }).finally(() => {
                    this._BusyDialog.close();
                });
            } catch (error) {
                MessageBox.error(error);
                this._BusyDialog.close();
            }
        },

        _callODataAction: function (bEvent, aRequestData) {
            var that = this;
            let postDocs = [JSON.stringify(aRequestData)];
            var promise = new Promise(function (resolve, reject) {
                that._CallODataV2("ACTION", "/processLogic", [], {
                    "Zzkey": postDocs,
                    "Event": bEvent,
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
        onExport: function () {
            var aData = this.getView().getModel("local").getProperty("/excelSet");

            if (!aData || aData.length === 0) {
                sap.m.MessageToast.show("No data to export.");
                return;
            }

            var aColumns = [
                {
                    label: this.getView().getModel("i18n").getProperty("Status"),
                    property: "Status"
                },
                {
                    label: this.getView().getModel("i18n").getProperty("Message"),
                    property: "Message"
                },

                {
                    label: this.getView().getModel("i18n").getProperty("SALESORGANIZATION"),
                    property: "SALESORGANIZATION"
                },    
                {
                    label: this.getView().getModel("i18n").getProperty("DISTRIBUTIONCHANNEL"),
                    property: "DISTRIBUTIONCHANNEL"
                },
                {
                    label: this.getView().getModel("i18n").getProperty("Customer"),
                    property: "Customer"
                },
                {
                    label: this.getView().getModel("i18n").getProperty("Product"),
                    property: "Product"
                },
                {
                    label: this.getView().getModel("i18n").getProperty("MATERIALBYCUSTOMER"),
                    property: "MATERIALBYCUSTOMER"
                },
                {
                    label: this.getView().getModel("i18n").getProperty("AdditionalCustomerMaterial"),
                    property: "AdditionalCustomerMaterial"
                },
                {
                    label: this.getView().getModel("i18n").getProperty("AdditionalCustomerMaterialText"),
                    property: "AdditionalCustomerMaterialText"
                }
            ];
            var aTitle = this.getView().getModel("i18n").getProperty("appTitle");
            var oSettings = {
                workbook: {
                    columns: aColumns
                },
                dataSource: aData,
                fileName: aTitle + "_export.xlsx"
            };

            var oSheet = new Spreadsheet(oSettings);
            oSheet.build().finally(function () {
                oSheet.destroy();
            });
        }
    });
});
