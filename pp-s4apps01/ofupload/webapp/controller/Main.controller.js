sap.ui.define([
    "./BaseController",
    "sap/m/BusyDialog",
    "../model/formatter",
    "../lib/xlsx",
    "sap/ui/export/Spreadsheet",
    "./messages",
], (BaseController, BusyDialog, formatter, xlsx, Spreadsheet, messages) => {
    "use strict";

    return BaseController.extend("pp.ofupload.controller.Main", {
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
            var oFilter = new sap.ui.model.Filter("Object", sap.ui.model.FilterOperator.EQ, "ZUPLOAD_OFUPLOAD");
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
            //     if (!aAllAccessBtns.some(btn => btn.AccessId === "ofupload-View")) {
            //         if (!this.oErrorMessageDialog) {
                    let aRequiredFields = ["Plant", "Material", "RequirementDate", "RequirementQty"];
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
            //             View: aAllAccessBtns.some(btn => btn.AccessId === "ofupload-View"),
            //             Upload: aAllAccessBtns.some(btn => btn.AccessId === "ofupload-Upload"),
            //             Check: aAllAccessBtns.some(btn => btn.AccessId === "ofupload-Check"),
            //             Execute: aAllAccessBtns.some(btn => btn.AccessId === "ofupload-Execute"),
            //             Export: aAllAccessBtns.some(btn => btn.AccessId === "ofupload-Export"),
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

            // 检测是否为横版模板：检查数据行中是否存在日期格式的键名（如 "2024/5/6"）
            const DATE_KEY_PATTERN = /^\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}$/;
            const bIsHorizontal = aSheet1.length > 5 &&
                aSheet1.slice(5).some(row =>
                    Object.keys(row).some(key => DATE_KEY_PATTERN.test(key))
                );

            for (var i = 5; i < aSheet1.length; i++) {
                let oRow = aSheet1[i];

                if (bIsHorizontal) {
                    // 横版模板：提取固定属性，将日期列逐一转换为竖版行
                    const oFixedProps = {
                        Customer: oRow["Customer"] || "",
                        Version: oRow["Version"] || "",
                        Material: oRow["Material"] || "",
                        Plant: oRow["Plant"] || "",
                        Remark: oRow["Remark"] || "",
                    };

                    // 筛选日期列：排除固定属性列和 __EMPTY_N 列
                    const aDateKeys = Object.keys(oRow).filter(key => {
                        return key !== "Customer" &&
                            key !== "Version" &&
                            key !== "Material" &&
                            key !== "Plant" &&
                            key !== "Remark" &&
                            !/^__EMPTY_\d+$/.test(key);
                    });

                    aDateKeys.forEach(dateKey => {
                        const sQty = oRow[dateKey];
                        if (sQty && String(sQty).trim() !== "") {
                            aExcelSet.push({
                                Type: "",
                                Message: "",
                                Tabix: i,
                                ...oFixedProps,
                                RequirementDate: formatter.dateFormatter(dateKey, "yyyyMMdd") || "",
                                RequirementQty: sQty || "",
                            });
                        }
                    });
                } else {
                    // 竖版模板（原有逻辑）
                    aExcelSet.push({
                        Type: "",
                        Message: "",
                        Tabix: i,
                        Customer: oRow["Customer"] || "",
                        Version: oRow["Version"] || "",
                        Material: oRow["Material"] || "",
                        Plant: oRow["Plant"] || "",
                        RequirementDate: formatter.dateFormatter(oRow["RequirementDate"], "yyyyMMdd") || "",
                        RequirementQty: oRow["RequirementQty"] || "",
                        Remark: oRow["Remark"] || "",
                    });
                }
            }

            if (aExcelSet.length === 0) {
                return;
            }
            this._LocalData.setProperty("/excelSet", aExcelSet);
            // this.getErrorCount(aExcelSet, "check");
        },

        onCheck: function (oEvent) {
            // ofupload does not perform frontend checks; delegate to backend CHECK action
            let aPostBody = this.preparePostBody();
            if (!aPostBody || aPostBody.length === 0) {
                return;
            }
            this.postAction("processLogic", "CHECK", JSON.stringify(aPostBody));
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
                    switch (sEvent) {
                        case "CHECK":
                            this.getErrorCount(aExcelSet, "check");
                            break;
                        case "EXECUTE":
                            this.getErrorCount(aExcelSet, "save");
                            break;
                    }
                    
                    this._BusyDialog.close();
                }.bind(this),
                error: function (oError) {
                    messages.showError(messages.parseErrors(oError));
                    this._BusyDialog.close();
                }.bind(this)
            });
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
        }
     });
});