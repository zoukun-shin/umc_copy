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

    return Base.extend("pp.zngrecordupload.controller.Main", {

        formatter: formatter,

        onInit: function () {
            this.getRouter().getRoute("Main").attachMatched(this._initialize, this);
        },

        _initialize: function () {
            var sLanguage = sap.ui.getCore().getConfiguration().getLanguage().substring(0, 2).toUpperCase();
            var oFilter = new sap.ui.model.Filter("Object", sap.ui.model.FilterOperator.EQ, "ZUPLOAD_NG_" + sLanguage);
            var oControlBinding = this.byId("idTemplateCollection").getBinding("items");
            oControlBinding.filter(oFilter);

            this._BusyDialog = new BusyDialog();
            this._UserInfo = sap.ushell.Container.getService("UserInfo");
            var sUser = this._UserInfo.getFullName() === undefined ? "" : this._UserInfo.getFullName();
            var sEmail = this._UserInfo.getEmail() === undefined ? "" : this._UserInfo.getEmail();
            sEmail = "xinlei.xu@sh.shin-china.com";
            var oContextBinding = this.getModel("Authority").bindContext("/User(Mail='" + sEmail + "',IsActiveEntity=true)", undefined, {
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
                if (!aAllAccessBtns.some(btn => btn.AccessId === "zngrecordupload-View")) {
                    if (!this.oErrorMessageDialog) {
                        this.oErrorMessageDialog = new sap.m.Dialog({
                            type: sap.m.DialogType.Message,
                            state: "Error",
                            content: new sap.m.Text({
                                text: this.getModel("i18n").getResourceBundle().getText("noAuthorityView", [sUser])
                            })
                        });
                    }
                    this.getView().destroy();
                    this.oErrorMessageDialog.open();
                }
                this.getModel("local").setProperty("/authorityCheck", {
                    button: {
                        View: aAllAccessBtns.some(btn => btn.AccessId === "zngrecordupload-View"),
                        Clear: aAllAccessBtns.some(btn => btn.AccessId === "zngrecordupload-Clear"),
                        Check: aAllAccessBtns.some(btn => btn.AccessId === "zngrecordupload-Check"),
                        Excute: aAllAccessBtns.some(btn => btn.AccessId === "zngrecordupload-Excute"),
                        Export: aAllAccessBtns.some(btn => btn.AccessId === "zngrecordupload-Export")
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
                            text: this.getModel("i18n").getResourceBundle().getText("getAuthorityFailed")
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
                // read valid data starting from line 14
                for (var i = 5; i < aSheetData.length; i++) {
                    var item = {
                        "Status": "",
                        "Message": "",
                        "RowNo": aSheetData[i]["RowNo"] === undefined ? "" : aSheetData[i]["RowNo"],
                        "Plant": aSheetData[i]["Plant"] === undefined ? "" : aSheetData[i]["Plant"],
                        "MoveType": aSheetData[i]["MoveType"] === undefined ? "" : aSheetData[i]["MoveType"],
                        "MaterialType": aSheetData[i]["MaterialType"] === undefined ? "" : aSheetData[i]["MaterialType"],
                        "LocationFrom": aSheetData[i]["FromLocation"] === undefined ? "" : aSheetData[i]["FromLocation"],
                        "LocationTo1": aSheetData[i]["TOLocaiton1"] === undefined ? "" : aSheetData[i]["TOLocaiton1"],
                        "LocationTo2": aSheetData[i]["TOLocaiton2"] === undefined ? "" : aSheetData[i]["TOLocaiton2"],
                        "ItemNo": aSheetData[i]["ItemNo"] === undefined ? "" : aSheetData[i]["ItemNo"],
                        "WorkCenter": aSheetData[i]["WorkCenter"] === undefined ? "" : aSheetData[i]["WorkCenter"],
                        "Shift": aSheetData[i]["Shift"] === undefined ? "" : aSheetData[i]["Shift"],
                        "Customer": aSheetData[i]["Customer"] === undefined ? "" : aSheetData[i]["Customer"],
                        "ProductionOrder": aSheetData[i]["ProductionOrder"] === undefined ? "" : aSheetData[i]["ProductionOrder"],
                        "Assembly": aSheetData[i]["Assembly"] === undefined ? "" : aSheetData[i]["Assembly"],
                        "Material": aSheetData[i]["NGMaterial"] === undefined ? "" : aSheetData[i]["NGMaterial"],
                        "NG_Position": aSheetData[i]["NGPosition"] === undefined ? "" : aSheetData[i]["NGPosition"],
                        "Factor": aSheetData[i]["Factor"] === undefined ? "" : aSheetData[i]["Factor"],
                        "Quantity": aSheetData[i]["Quantity"] === undefined ? "" : aSheetData[i]["Quantity"],
                        "FoundDate": aSheetData[i]["DateNGFound"] === undefined ? "" : this.conversionDate(aSheetData[i]["DateNGFound"]),
                        "Symptom": aSheetData[i]["Symptom"] === undefined ? "" : aSheetData[i]["Symptom"],
                        "RootCause": aSheetData[i]["RootCause"] === undefined ? "" : aSheetData[i]["RootCause"],
                        "CounterMeasure": aSheetData[i]["CounterMeasure"] === undefined ? "" : aSheetData[i]["CounterMeasure"]
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
            this._callOData("EXCUTE");
        },

        onExport: function () {
            this._callOData("EXPORT");
        },

        _callOData: function (bEvent) {
            var aPromise = [];
            var aExcelSet = this.getModel("local").getProperty("/excelSet");
            aPromise.push(this._callODataAction(bEvent, aExcelSet));
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
                        var boundContext = activeContext.getBoundContext();
                        var object = boundContext.getObject();
                        if (bEvent === "EXPORT") {
                            if (object.RecordUUID) {
                                var sURL = this.getModel("Print").getServiceUrl() + "PrintRecord(RecordUUID=" + object.RecordUUID + ",IsActiveEntity=true)/PDFContent";
                                sap.m.URLHelper.redirect(sURL, true);
                            }
                        } else {
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
        },

        _callODataAction: function (bEvent, aRequestData) {
            return new Promise((resolve, reject) => {
                var uploadProcess = this.getModel().bindContext("/UploadNG/com.sap.gateway.srvd.zui_ng_record_upload_o4.v0001.processLogic(...)");
                uploadProcess.setParameter("Event", bEvent);
                uploadProcess.setParameter("Zzkey", JSON.stringify(aRequestData));
                uploadProcess.setParameter("RecordUUID", '');
                uploadProcess.execute("$auto", false, null, /*bReplaceWithRVC*/false).then(() => {
                    resolve(uploadProcess);
                }).catch((error) => {
                    reject(error);
                });
            });
        }
    });
});
