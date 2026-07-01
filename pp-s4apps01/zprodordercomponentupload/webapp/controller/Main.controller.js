sap.ui.define([
    "./Base",
    "../model/formatter",
    "../lib/xlsx",
    "sap/m/BusyDialog",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/export/Spreadsheet"
], function (Base, formatter, xlsx, BusyDialog, MessageBox, MessageToast, Spreadsheet) {
    "use strict";

    return Base.extend("pp.zprodordercomponentupload.controller.Main", {
        formatter: formatter,
        
        onInit: function () {
            this._UserInfo = sap.ushell.Container.getService("UserInfo");
            this.getRouter().getRoute("RouteMain").attachMatched(this._initialize, this);
        },

        _initialize: function () {
            var sLanguage = sap.ui.getCore().getConfiguration().getLanguage().substring(0, 2).toUpperCase();
            var oFilter = new sap.ui.model.Filter("Object", sap.ui.model.FilterOperator.EQ, "ZUPLOAD_PRODORDERCOMPONENT_" + sLanguage);
            var oControlBinding = this.byId("idTemplateCollection").getBinding("items");
            oControlBinding.filter(oFilter);

            this._BusyDialog = new BusyDialog();
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
                if (!aAllAccessBtns.some(btn => btn.AccessId === "zprodordercomponentupload-View")) {
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
                        View: aAllAccessBtns.some(btn => btn.AccessId === "zprodordercomponentupload-View"),
                        Clear: aAllAccessBtns.some(btn => btn.AccessId === "zprodordercomponentupload-Clear"),
                        Check: aAllAccessBtns.some(btn => btn.AccessId === "zprodordercomponentupload-Check"),
                        Execute: aAllAccessBtns.some(btn => btn.AccessId === "zprodordercomponentupload-Execute"),
                        Export: aAllAccessBtns.some(btn => btn.AccessId === "zprodordercomponentupload-Export")
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
                var iRowNo = 0;
                // Read valid data starting from line 2
                for (var i = 0; i < aSheetData.length; i++) {
                    iRowNo += 1;
                    var item = {
                        "Status": "",
                        "Message": "",
                        "RowNo": iRowNo,
                        "ProductionOrder": aSheetData[i]["ProductionOrder"] === undefined ? "" : aSheetData[i]["ProductionOrder"],
                        "ProductionOrderOperation": aSheetData[i]["ProductionOrderOperation"] === undefined ? "" : aSheetData[i]["ProductionOrderOperation"],
                        "Material": aSheetData[i]["Material"] === undefined ? "" : aSheetData[i]["Material"],
                        "RequiredQuantity": aSheetData[i]["RequiredQuantity"] === undefined ? "" : aSheetData[i]["RequiredQuantity"],
                        "UserEmail": this._UserInfo.getEmail() === undefined ? "" : this._UserInfo.getEmail()
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
            this._callOData("Check");
        },

        onExecute: function () {
            this._callOData("Execute");
        },

        onExport: function () {
            var oTable = this.byId("idTable");
            var aExcelSet = this.getModel("local").getProperty("/excelSet");
            var aExcelCol = [];
            var aTableCol = oTable.getColumns();
            for (var i = 0; i < aTableCol.length; i++) {
                if (aTableCol[i].getVisible()) {
                    var sLabelText = aTableCol[i].getAggregation("label").getText();
                    var sType, sTextAlign, sUnitProperty, bDelimiter, iScale;
                    var sFieldName = aTableCol[i].getAggregation("template").getBindingPath("text");
                    if (!sFieldName) {
                        sFieldName = aTableCol[i].getAggregation("template").mBindingInfos.state.parts[0].path;
                    }

                    switch (sFieldName) {
                        //  Number 
                        case "RequiredQuantity":
                            sType = sap.ui.export.EdmType.Number;
                            bDelimiter = true;
                            sTextAlign = "End";
                            // iScale = 3;
                            // sUnitProperty = "";
                            break;
                        default:
                            sType = sap.ui.export.EdmType.String;
                            sTextAlign = "Begin";
                            break;
                    }
                    var oExcelCol = {
                        label: sLabelText,
                        type: sType,
                        property: sFieldName,
                        width: parseFloat(aTableCol[i].getWidth()),
                        textAlign: sTextAlign,
                        unitProperty: sUnitProperty,
                        delimiter: bDelimiter,
                        scale: iScale
                    };
                    aExcelCol.push(oExcelCol);
                }
            }
            var oSettings = {
                workbook: {
                    columns: aExcelCol,
                    context: {
                        version: "1.54",
                        hierarchyLevel: "level"
                    }
                },
                dataSource: aExcelSet,
                fileName: this.getModel("i18n").getResourceBundle().getText("appTitle") + "_" + this.getCurrentDateTime() + ".xlsx"
            };
            // export excel file
            new Spreadsheet(oSettings).build();
        },

        _callOData: function (sEvent) {
            var aPromise = [];
            var aExcelSet = this.getModel("local").getProperty("/excelSet");
            aPromise.push(this._CallODataV2("ACTION", "/processLogic", [], {
                "Event": sEvent,
                "Zzkey": JSON.stringify(aExcelSet),
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
                    for (const activeContext of aContext) {
                        var object = activeContext.processLogic;
                        JSON.parse(object.Zzkey).forEach(element => {
                            for (var index = 0; index < aExcelSet.length; index++) {
                                if (aExcelSet[index].RowNo === element.ROWNO) {
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
