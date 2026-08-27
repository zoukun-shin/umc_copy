sap.ui.define([
    "./BaseController",
    "sap/m/BusyDialog",
    "../model/formatter",
    "../lib/xlsx",
    "sap/ui/export/Spreadsheet",
    "./messages",
], (BaseController, BusyDialog, formatter, xlsx, Spreadsheet, messages) => {
    "use strict";

    return BaseController.extend("mm.purorderpricing.controller.Main", {
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
            this._LocalData.setProperty("/excelSet", []);
            this._LocalData.setProperty("/logInfo", "");
            this._LocalData.setProperty("/recordCheckSuccessed", false);

            var sUser = this._UserInfo.getFullName() === undefined ? "" : this._UserInfo.getFullName();
            var sEmail = this._UserInfo.getEmail() === undefined ? "" : this._UserInfo.getEmail();
            
            var oFilter = new sap.ui.model.Filter("Object", sap.ui.model.FilterOperator.EQ, "ZUPLOAD_POPRICING");
            var oControlBinding = this.byId("idTemplateCollection").getBinding("items");
            oControlBinding.filter(oFilter);

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
                if (!aAllAccessBtns.some(btn => btn.AccessId === "purorderpricing-View")) {
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
                this._LocalData.setProperty("/authorityCheck", {
                    button: {
                        View: aAllAccessBtns.some(btn => btn.AccessId === "purorderpricing-View"),
                        Upload: aAllAccessBtns.some(btn => btn.AccessId === "purorderpricing-Upload"),
                        Check: aAllAccessBtns.some(btn => btn.AccessId === "purorderpricing-Check"),
                        Execute: aAllAccessBtns.some(btn => btn.AccessId === "purorderpricing-Execute"),
                        Export: aAllAccessBtns.some(btn => btn.AccessId === "purorderpricing-Export")
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

        onFileUploaderChange: function (oEvent) {
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
                var sResult = e.target.result;
                /*global XLSX*/
                var oWB = XLSX.read(sResult, {
                    type: "binary",
                    cellDates: true,
                    dateNF: "yyyy/mm/dd;@"
                });
                var oSheet1 = oWB.Sheets[oWB.SheetNames[0]];
                var aSheet1 = XLSX.utils.sheet_to_row_object_array(oSheet1, { raw: false });
                this.readSheet(aSheet1);
            }.bind(this);
        },

        readSheet: function (aSheet1) {
            var aExcelSet = [];
            // FS：上传数据从模板的第2行开始读取（index 1）
            for (var i = 4; i < aSheet1.length; i++) {
                var oItem = {
                    Type: "",
                    Message: "",
                    Tabix: i,
                    PurchaseOrder: aSheet1[i]["PurchaseOrder"] || "",
                    PurchaseOrderItem: aSheet1[i]["PurchaseOrderItem"] || "",
                    Material: aSheet1[i]["Material"] || "",
                    Plant: aSheet1[i]["Plant"] || "",
                    ConditionRateAmount: aSheet1[i]["ConditionRateAmount"] || ""
                };
                aExcelSet.push(oItem);
            }
            if (aExcelSet.length === 0) {
                return;
            }
            this._LocalData.setProperty("/excelSet", aExcelSet);
        },

        onCheck: function () {
            this.postAction("processLogic","check");
        },

        onExecute: function () {
            this.postAction("processLogic","execute");
        },

        postAction: function (sAction,sEvent) {
            var aExcelSet = this._LocalData.getProperty("/excelSet");
            this._BusyDialog.open();

            this._oDataModel.callFunction(`/${sAction}`, {
                method: "POST",
                urlParameters: {
                    Event: sEvent,
                    Zzkey: JSON.stringify(aExcelSet)
                },
                success: function (oData) {
                    var aResult = JSON.parse(oData[sAction].Zzkey);
                    aResult.forEach(function (line) {
                        // let searchKey = `${line.PLANT}_${line.MATERIAL}`;
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
                    this.getErrorCount(aExcelSet, sEvent);
                    this._BusyDialog.close();
                }.bind(this),
                error: function (oError) {
                    messages.showError(messages.parseErrors(oError));
                    this._BusyDialog.close();
                }.bind(this)
            });
        },

        getErrorCount: function (aExcelSet,sAction) {
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
			var sLogInfo = this._ResourceBundle.getText("logInfo", [iTotal, iSuccess, iError]);//logInfo={0}件中、{1}件の取込に成功、{2}件の取込に失敗しました
			this._LocalData.setProperty("/logInfo", sLogInfo);
			// 可以根据是否错误控制一些按钮状态
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

            // 添加 Type 列
            aExcelCol.push({
                label: this._ResourceBundle.getText("Status"),
                type: "string",
                property: "Type",
                width: 8
            });
            for (var i = 1; i < aTableCol.length; i++) {
                if (aTableCol[i].getVisible()) {
                    var sLabelText = aTableCol[i].getAggregation("label").getText();
                    var sProperty = aTableCol[i].getAggregation("template").getBindingPath("text");
                    aExcelCol.push({
                        label: sLabelText,
                        type: "string",
                        property: sProperty,
                        width: parseFloat(aTableCol[i].getWidth())
                    });
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
        }
    });
});