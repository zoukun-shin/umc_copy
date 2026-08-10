sap.ui.define([
    "./BaseController",
    "sap/m/BusyDialog",
    "../model/formatter",
    "../lib/xlsx",
    "sap/ui/export/Spreadsheet",
    "./messages",
], (BaseController, BusyDialog, formatter, xlsx, Spreadsheet, messages) => {
    "use strict";

    return BaseController.extend("mm.quotaarrangement.controller.Main", {
        formatter: formatter,
        onInit() {
            this._LocalData = this.getOwnerComponent().getModel("local");
            this._oDataModel = this.getOwnerComponent().getModel();
            this._ResourceBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
            this._BusyDialog = new BusyDialog();

            this._UserInfo = sap.ushell.Container.getService("UserInfo");
            this.getRouter().getRoute("RouteMain").attachMatched(this._initialize, this);
        },

        _initialize: function () {
            // var sUser = this._UserInfo.getFullName() === undefined ? "" : this._UserInfo.getFullName();
            // var sEmail = this._UserInfo.getEmail() === undefined ? "" : this._UserInfo.getEmail();

            var sLanguage = sap.ui.getCore().getConfiguration().getLanguage().substring(0, 2).toUpperCase();
            var oFilter = new sap.ui.model.Filter("Object", sap.ui.model.FilterOperator.EQ, "ZUPLOAD_QUOTAARRGMT");
            var oControlBinding = this.byId("idTemplateCollection").getBinding("items");
            oControlBinding.filter(oFilter);

            // var oContextBinding = this.getModel("Authority").bindContext("/User(Mail='" + sEmail + "',IsActiveEntity=true)", undefined, {
            //     "$expand": "_AssignPlant,_AssignCompany,_AssignSalesOrg,_AssignPurchOrg,_AssignRole($expand=_UserRoleAccessBtn)"
            // });
            // oContextBinding.requestObject().then(function (context) {
            //     var aAccessBtns = [],
            //         aAllAccessBtns = [];
            //     if (context._AssignRole && context._AssignRole.length > 0) {
            //         context._AssignRole.forEach(role => {
            //             aAccessBtns.push(role._UserRoleAccessBtn);
            //         });
            //         aAllAccessBtns = aAccessBtns.flat();
            //     }
            //     if (!aAllAccessBtns.some(btn => btn.AccessId === "quotaarrangement-View")) {
            //         if (!this.oErrorMessageDialog) {
            //             this.oErrorMessageDialog = new sap.m.Dialog({
            //                 type: sap.m.DialogType.Message,
            //                 state: "Error",
            //                 content: new sap.m.Text({
            //                     text: this.getModel("i18n").getResourceBundle().getText("noAuthorityView", [sUser])
            //                 })
            //             });
            //         }
            //         this.getView().destroy();
            //         this.oErrorMessageDialog.open();
            //     }
            //     this.getModel("local").setProperty("/authorityCheck", {
            //         button: {
            //             View: aAllAccessBtns.some(btn => btn.AccessId === "quotaarrangement-View"),
            //             Upload: aAllAccessBtns.some(btn => btn.AccessId === "quotaarrangement-Upload"),
            //             Check: aAllAccessBtns.some(btn => btn.AccessId === "quotaarrangement-Check"),
            //             Execute: aAllAccessBtns.some(btn => btn.AccessId === "quotaarrangement-Execute"),
            //             Export: aAllAccessBtns.some(btn => btn.AccessId === "quotaarrangement-Export"),
            //         },
            //         data: {
            //             PlantSet: context._AssignPlant,
            //             CompanySet: context._AssignCompany,
            //             SalesOrgSet: context._AssignSalesOrg,
            //             PurchOrgSet: context._AssignPurchOrg,
            //             RoleSet: context._AssignRole
            //         }
            //     });
            // }.bind(this), function (oError) {
            //     if (!this.oErrorMessageDialog) {
            //         this.oErrorMessageDialog = new sap.m.Dialog({
            //             type: sap.m.DialogType.Message,
            //             state: "Error",
            //             content: new sap.m.Text({
            //                 text: this.getModel("i18n").getResourceBundle().getText("getAuthorityFailed")
            //             })
            //         });
            //     }
            //     this.getView().destroy();
            //     this.oErrorMessageDialog.open();
            // }.bind(this));

                this.getModel("local").setProperty("/authorityCheck", {
                    button: {
                        View: true,
                        Upload: true,
                        Check: true,
                        Execute: true,
                        Export: true,
                    }
                });
        },

        onFileUploaderChange: function (oEvent) {
            /*global XLSX*/
            this._LocalData.setProperty("/logInfo", "");
            this._LocalData.setProperty("/recordCheckSuccessed", false);
            var oFile = oEvent.getParameter("files")[0];
            if (!oFile) {
                this._LocalData.setProperty("/excelSet", []);
                return;
            }

            var oReader = new FileReader();
            oReader.readAsArrayBuffer(oFile);
            oReader.onload = function (e) {
                this.isEnable = true;
                var sResult = e.target.result;
                var oWB = XLSX.read(sResult, {
                    type: "binary",
                    cellDates: true,
                    dateNF: 'yyyy/mm/dd;@',
                });
                var oSheet1 = oWB.Sheets[oWB.SheetNames[0]];
                var aSheet1 = XLSX.utils.sheet_to_row_object_array(oSheet1, { raw: false });
                this.readSheet(aSheet1);

            }.bind(this);
        },

        readSheet: function (aSheet1) {
            let aExcelSet = [];
            let oItem;
            for (var i = 2; i < aSheet1.length; i++) {
                oItem = {
                    Type: "",
                    Message: "",
                    Tabix: i,
                    Usage: aSheet1[i]["Usage"] || "",
                    Material: aSheet1[i]["Material"] || "",
                    Plant: aSheet1[i]["Plant"] || "",
                    QuotaArrangement: aSheet1[i]["QuotaArrangement"] || "",
                    ValidityStartDate: formatter.odataDate(aSheet1[i]["ValidityStartDate"]) || "",
                    ValidityEndDate: formatter.odataDate(aSheet1[i]["ValidityEndDate"]) || "",
                    QuotaArrangementItem: aSheet1[i]["QuotaArrangementItem"] || "",
                    MaterialProcurementCategory: aSheet1[i]["MaterialProcurementCategory"] || "",
                    MaterialProcurementType: aSheet1[i]["MaterialProcurementType"] || "",
                    Supplier: aSheet1[i]["Supplier"] || "",
                    PurchasingSourceQuota: aSheet1[i]["PurchasingSourceQuota"] || "",
                    ManufacturerMaterial: aSheet1[i]["ManufacturerMaterial"] || ""
                };
                aExcelSet.push(oItem);
            }
            if (aExcelSet.length === 0) {
                return;
            }
            this._LocalData.setProperty("/excelSet", aExcelSet);
        },

        onCheck: function (oEvent) {
            this.checkRequired();
            let aExcelSet = this._LocalData.getProperty("/excelSet") || [];
            if (aExcelSet.length === 0) {
                return;
            }

            // 使用第一行的 Usage 作为参考，要求所有行的 Usage 必须相同
            const sRefUsage = (aExcelSet[0].Usage || "");
            const bInconsistent = aExcelSet.some(item => (item.Usage || "") !== sRefUsage);
            if (bInconsistent) {
                aExcelSet.forEach(function (item) {
                    item.Type = "E";
                    item.Message = this._ResourceBundle.getText("msg02");
                }.bind(this));
                this._LocalData.setProperty("/excelSet", aExcelSet);
            }

            // 如果一致，确保界面显示最新校验结果
            this._LocalData.setProperty("/excelSet", aExcelSet);

            // 检查同组 PurchasingSourceQuota 总和是否大于100
            const oGroupSum = {};
            aExcelSet.forEach(function (item) {
                const sKey = [item.Material, item.Plant, item.QuotaArrangement, item.ValidityStartDate, item.ValidityEndDate].join("|");
                if (!oGroupSum[sKey]) {
                    oGroupSum[sKey] = 0;
                }
                oGroupSum[sKey] += parseFloat(item.PurchasingSourceQuota) || 0;
            });
            for (const sKey in oGroupSum) {
                if (oGroupSum[sKey] > 100) {
                    aExcelSet.forEach(function (item) {
                        const sItemKey = [item.Material, item.Plant, item.QuotaArrangement, item.ValidityStartDate, item.ValidityEndDate].join("|");
                        if (sItemKey === sKey) {
                            item.Type = "E";
                            item.Message = this._ResourceBundle.getText("msg03");
                        }
                    }.bind(this));
                }
            }

            this._LocalData.setProperty("/excelSet", aExcelSet);
            this.getErrorCount(aExcelSet, "check");
        },

        onExcute: function (oEvent) {
            let aPostBody = this.preparePostBody();
            this.postAction("processLogic", "EXECUTE", JSON.stringify(aPostBody));
        },

        preparePostBody: function () {
            let aExcelSet = this._LocalData.getProperty("/excelSet");
            return aExcelSet;
        },

        postAction: function (sAction, sEvent, postData) {
            this._BusyDialog.open();
            var aExcelSet = this._LocalData.getProperty("/excelSet");
            var oModel = this._oDataModel;
            oModel.callFunction(`/${sAction}`, {
                method: "POST",
                changeSetId: 1,
                urlParameters: {
                    Event: sEvent,
                    Zzkey: postData
                },
                success: function (oData) {
                    let object = JSON.parse(oData[sAction].Zzkey);
                    object.forEach(function (line) {
                        let searchKey = `${line.TABIX}`;
                        let item = aExcelSet.find(item => {
                            const key = `${item.Tabix}`;
                            return key === searchKey;
                        });
                        if (item) {
                            item.Type = line.TYPE;
                            item.Message = line.MESSAGE;
                        }
                    });
                    this._LocalData.setProperty("/excelSet", aExcelSet);
                    this.getErrorCount(aExcelSet, "save");
                    this._BusyDialog.close();
                }.bind(this),
                error: function (oError) {
                    messages.showError(messages.parseErrors(oError));
                    this._BusyDialog.close();
                }.bind(this)
            });
        },

        checkRequired: function () {
            let aExcelSet = this._LocalData.getProperty("/excelSet");
            let isExistError = false;
            let aRequiredFields = ["Plant", "Material", "ValidityStartDate", "ValidityEndDate", 
                "MaterialProcurementCategory", "MaterialProcurementType", "Supplier"];

            for (let i = 0; i < aExcelSet.length; i++) {
                let oItem = aExcelSet[i];
                oItem.Type = "S";
                oItem.Message = "";
                for (let field of aRequiredFields) {
                    if (!oItem[field]) {
                        oItem.Type = "E";
                        oItem.Message = this._ResourceBundle.getText("msg01");
                        isExistError = true;
                    }
                }
            }
            this.getErrorCount(aExcelSet, "check");
        },

        onExport: function (oEvent) {
            var sId = oEvent.getSource().getParent().getParent().getId();
            var oTable = this.getView().byId(sId);
            var sPath = oTable.getBindingPath("rows");
            var aExcelSet = this._LocalData.getProperty(sPath);

            var oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({ pattern: "yyyyMMdd" });
            var oTimeFormat = sap.ui.core.format.DateFormat.getTimeInstance({ pattern: "HHmmss" });
            var sFileName = this._ResourceBundle.getText("title") + "_" +
                oDateFormat.format(new Date()) + oTimeFormat.format(new Date());

            var aExcelCol = [];
            var aTableCol = oTable.getColumns();
            aExcelCol.push({
                label: this._ResourceBundle.getText("Type"),
                type: "string",
                property: "Type",
                width: 8
            });
            for (var i = 1; i < aTableCol.length; i++) {
                if (aTableCol[i].getVisible()) {
                    var sLabelText = aTableCol[i].getAggregation("label").getText();
                    var sProperty = aTableCol[i].getAggregation("template").getBindingPath("text");
                    var sType = "string";
                    var oExcelCol = {
                        label: sLabelText,
                        type: sType,
                        property: sProperty,
                        width: parseFloat(aTableCol[i].getWidth())
                    };
                    aExcelCol.push(oExcelCol);
                }
            }
            var oSettings = {
                workbook: {
                    columns: aExcelCol,
                    context: {
                        version: "${version}",
                        hierarchyLevel: "level"
                    }
                },
                dataSource: aExcelSet,
                fileName: sFileName
            };
            new Spreadsheet(oSettings).build();
        },

        getErrorCount: function (aExcelSet, sAction) {
            switch (sAction) {
                case "check":
                    this._LocalData.setProperty("/recordCheckSuccessed", false);
                    break;
                case "save":
                    this._LocalData.setProperty("/recordCheckSuccessed", true);
                    break;
            }
            var iTotal = 0,
                iError = 0,
                iSuccess = 0;
            iTotal = aExcelSet.length;
            aExcelSet.forEach(function (value) {
                if (value.Type === "E") {
                    iError++;
                } else {
                    iSuccess++;
                }
            });
            var sLogInfo = this._ResourceBundle.getText("logInfo", [iTotal, iSuccess, iError]);
            this._LocalData.setProperty("/logInfo", sLogInfo);
            if (iError > 0) {
                return;
            }
            switch (sAction) {
                case "check":
                    this._LocalData.setProperty("/recordCheckSuccessed", true);
                    break;
                case "save":
                    this._LocalData.setProperty("/recordCheckSuccessed", false);
                    break;
            }
        },

    });
});