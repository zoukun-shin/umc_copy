sap.ui.define([
    "../model/formatter",
    "../lib/xlsx",
    "sap/m/BusyDialog",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/core/Fragment"
], function (formatter, xlsx, BusyDialog, MessageBox, MessageToast, Fragment) {
    'use strict';

    return {
        formatter: formatter,

        getAuthorityData: function (oModels, oViews) {
            var oAuthorityModel = oModels.Authority;
            var oLocalModel = oModels.local;
            var oI18nModel = oModels.i18n;
            var _UserInfo = sap.ushell.Container.getService("UserInfo");
            var sUser = _UserInfo.getFullName() === undefined ? "" : _UserInfo.getFullName();
            var sEmail = _UserInfo.getEmail() === undefined ? "" : _UserInfo.getEmail();
            var oContextBinding = oAuthorityModel.bindContext("/User(Mail='" + sEmail + "',IsActiveEntity=true)", undefined, {
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
                if (!aAllAccessBtns.some(btn => btn.AccessId === "zsalespurchaseprice-View")) {
                    if (!this.oErrorMessageDialog) {
                        this.oErrorMessageDialog = new sap.m.Dialog({
                            type: sap.m.DialogType.Message,
                            state: "Error",
                            content: new sap.m.Text({
                                text: oI18nModel.getResourceBundle().getText("noAuthorityView", [sUser])
                            })
                        });
                    }
                    oViews.destroy();
                    this.oErrorMessageDialog.open();
                }
                oLocalModel.setProperty("/authorityCheck", {
                    button: {
                        View: aAllAccessBtns.some(btn => btn.AccessId === "zsalespurchaseprice-View"),
                        Upload: aAllAccessBtns.some(btn => btn.AccessId === "zsalespurchaseprice-BatchUpload"),
                        Clear: aAllAccessBtns.some(btn => btn.AccessId === "zsalespurchaseprice-Clear"),
                        Check: aAllAccessBtns.some(btn => btn.AccessId === "zsalespurchaseprice-Check"),
                        Excute: aAllAccessBtns.some(btn => btn.AccessId === "zsalespurchaseprice-Excute"),
                        Export: aAllAccessBtns.some(btn => btn.AccessId === "zsalespurchaseprice-Export")
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
                            text: oI18nModel.getResourceBundle().getText("getAuthorityFailed")
                        })
                    });
                }
                oViews.destroy();
                this.oErrorMessageDialog.open();
            }.bind(this));
        },

        openUploadDialog: function () {
            var that = this;
            this._Function = sap.ui.require("fico/zsalespurchaseprice/ext/controller/ListReportExt");
            this._BusyDialog = new BusyDialog();
            this._BusyDialog.open();
            Fragment.load({
                name: "fico.zsalespurchaseprice.ext.fragments.Upload",
                controller: this
            }).then(function (oDialog) {
                //ダイアログがロードされたら
                this._UploadDialog = oDialog;
                //ダイアログからモデルを使用できるようにする
                this._view.addDependent(this._UploadDialog);
                this._UploadDialog.addButton(new sap.m.Button({
                    text: "{i18n>closeBtn}",
                    press: function () {
                        that.getModel("local").setProperty("/excelSet", []);
                        that.getModel("local").setProperty("/logInfo", "");
                        that._UploadDialog.destroy();
                    }
                }));
                this._BusyDialog.close();
                this._UploadDialog.open();
                var sLanguage = sap.ui.getCore().getConfiguration().getLanguage().substring(0, 2).toUpperCase();
                var oFilter = new sap.ui.model.Filter("Object", sap.ui.model.FilterOperator.EQ, "ZUPLOAD_SALESPURCHASEPRICE_" + sLanguage);
                var oControlBinding = sap.ui.getCore().byId("idTemplateCollection").getBinding("items");
                oControlBinding.filter(oFilter);
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
                // read valid data starting from line 7
                for (var i = 5; i < aSheetData.length; i++) {
                    var item = {
                        "Status": "",
                        "Message": "",
                        "Row": i - 4,
                        "PriceType": aSheetData[i]["PriceType"] === undefined ? "" : aSheetData[i]["PriceType"],
                        "CompanyCode": aSheetData[i]["CompanyCode"] === undefined ? "" : aSheetData[i]["CompanyCode"],
                        "FiscalYear": aSheetData[i]["FiscalYear"] === undefined ? "" : aSheetData[i]["FiscalYear"],
                        "Period": aSheetData[i]["Period"] === undefined ? "" : aSheetData[i]["Period"],
                        "Plant": aSheetData[i]["Plant"] === undefined ? "" : aSheetData[i]["Plant"],
                        "Material": aSheetData[i]["Material"] === undefined ? "" : aSheetData[i]["Material"],
                        "Price": aSheetData[i]["Price"] === undefined ? "" : aSheetData[i]["Price"],
                        "PriceUnit": aSheetData[i]["PriceUnit"] === undefined ? "" : aSheetData[i]["PriceUnit"],
                        "Currency": aSheetData[i]["Currency"] === undefined ? "" : aSheetData[i]["Currency"]
                    };
                    aExcelSet.push(item);
                }
                this.getModel("local").setProperty("/excelSet", aExcelSet);
                this.getModel("local").setProperty("/logInfo", this.getModel("i18n").getResourceBundle().getText("logInfo", [aExcelSet.length, 0, 0]));
                sap.ui.getCore().byId("idFileUploader").clear();
                this._BusyDialog.close();
            }.bind(this);
        },

        onClear: function () {
            this.getModel("local").setProperty("/excelSet", []);
            this.getModel("local").setProperty("/logInfo", "");
        },

        onCheck: function () {
            var that = this;
            that._Function._callOData("CHECK", that);
        },

        onExcute: function () {
            var that = this;
            that._Function._callOData("EXCUTE", that);
        },

        onExport: function () {
            var that = this;
            that._Function._callOData("EXPORT", that);
        },

        _callOData: function (bEvent, that) {
            var aPromise = [];
            var aExcelSet = that.getModel("local").getProperty("/excelSet");
            aPromise.push(that._Function._callODataAction(bEvent, aExcelSet, that));
            try {
                that._BusyDialog.open();
                Promise.all(aPromise).then((aContext) => {
                    var oResult = {
                        iSuccess: 0,
                        iFailed: 0
                    };
                    that._BusyDialog.close();
                    var aExcelSet = that.getModel("local").getProperty("/excelSet");
                    for (const activeContext of aContext) {
                        var boundContext = activeContext.getBoundContext();
                        var object = boundContext.getObject();
                        if (bEvent === "EXPORT") {
                            if (object.RecordUUID) {
                                var sURL = that.getModel("Print").getServiceUrl() + "PrintRecord(RecordUUID=" + object.RecordUUID + ",IsActiveEntity=true)/PDFContent";
                                sap.m.URLHelper.redirect(sURL, true);
                            }
                        } else {
                            JSON.parse(object.Zzkey).forEach(element => {
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
                    }
                    that.getModel("local").setProperty("/excelSet", aExcelSet);
                    if (bEvent !== "EXPORT") {
                        that.getModel("local").setProperty("/logInfo", that.getModel("i18n").getResourceBundle().getText("logInfo", [aExcelSet.length, oResult.iSuccess, oResult.iFailed]));
                    }
                    MessageToast.show(that.getModel("i18n").getResourceBundle().getText("ProcessingCompleted"));
                }).catch((error) => {
                    MessageBox.error(error);
                }).finally(() => {
                    that._BusyDialog.close();
                });
            } catch (error) {
                MessageBox.error(error);
                that._BusyDialog.close();
            }
        },

        _callODataAction: function (bEvent, aRequestData, that) {
            return new Promise((resolve, reject) => {
                var uploadProcess = that.getModel().bindContext("/ZC_TFI_1024/com.sap.gateway.srvd.zui_tfi_1024_o4.v0001.processLogic(...)");
                uploadProcess.setParameter("Event", bEvent);
                uploadProcess.setParameter("Zzkey", JSON.stringify(aRequestData));
                uploadProcess.setParameter("RecordUUID", '');
                uploadProcess.execute("$auto", false, null, /*bReplaceWithRVC*/false).then(() => {
                    resolve(uploadProcess);
                }).catch((error) => {
                    reject(error);
                });
            });
        },

        _removeDuplicates: function (arr, keys) {
            return arr.reduce((result, obj) => {
                const index = result.findIndex(item => {
                    return keys.every(key => item[key] === obj[key]);
                });
                if (index !== -1) {
                    result[index] = obj;
                } else {
                    result.push(obj);
                }
                return result;
            }, []);
        }
    };
});
