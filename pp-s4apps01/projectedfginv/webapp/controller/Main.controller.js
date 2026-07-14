sap.ui.define([
    "./Base",
    "../model/formatter",
    "sap/m/BusyDialog",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/Fragment",
    "sap/ui/table/Column",
    "sap/m/Label",
    "sap/m/Text",
    "sap/ui/export/Spreadsheet"
], function (Base, formatter, BusyDialog, MessageBox, Filter, FilterOperator, Fragment, UIColumn, Label, Text, Spreadsheet) {
    "use strict";

    return Base.extend("pp.projectedfginv.controller.Main", {

        formatter: formatter,

        onInit: function () {
            this._oTable = this.byId("idListTable");
            this._myBusyDialog = new BusyDialog();
            this._UserInfo = sap.ushell.Container.getService("UserInfo");
            this.getRouter().getRoute("Main").attachMatched(this._initialize, this);
        },

        _initialize: function () {
            // ADD BEGIN BY XINLEI XU 2026/01/16
            var sLanguage = sap.ui.getCore().getConfiguration().getLanguage().substring(0, 2).toUpperCase();
            var sSAPLanguage = "J";
            switch (sLanguage) {
                case "JA":
                    sSAPLanguage = "J";
                    break;
                case "EN":
                    sSAPLanguage = "E";
                    break;
                case "ZH":
                    sSAPLanguage = "1";
                    break;
                default:
                    sSAPLanguage = "J";
                    break;
            }
            var oFilter = new sap.ui.model.Filter("Zvalue3", sap.ui.model.FilterOperator.EQ, sSAPLanguage);
            var sUser = this._UserInfo.getFullName() === undefined ? "" : this._UserInfo.getFullName();
            var sEmail = this._UserInfo.getEmail() === undefined ? "" : this._UserInfo.getEmail();
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
                if (!aAllAccessBtns.some(btn => btn.AccessId === "projectedfginv-View")) {
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
                        View: aAllAccessBtns.some(btn => btn.AccessId === "projectedfginv-View"),
                        Export: aAllAccessBtns.some(btn => btn.AccessId === "projectedfginv-Export"),
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

        onSearch: function () {
            var aFilters = this.byId("idSmartFilterBar").getFilters();
            var sPeriodEndDate = this.byId("idSmartFilterBar").getControlByKey("PeriodEndDate").getDateValue();
            var sCurrentDate = new Date();
            sCurrentDate.setHours(0, 0, 0, 0); // 时分秒清0
            if (sPeriodEndDate < sCurrentDate) {
                MessageBox.error(this.getModel("i18n").getResourceBundle().getText("PeriodEndDateIsPast"));
                return;
            }

            var sDisplayDimension = this.getModel("local").getProperty("/filter/DisplayDimension");
            var sShowInclude = this.getModel("local").getProperty("/filter/ShowInclude");
            var sShowExpired = this.getModel("local").getProperty("/filter/ShowExpired");

            aFilters.push(new Filter("DisplayDimension", FilterOperator.EQ, sDisplayDimension));
            aFilters.push(new Filter("ShowInclude", FilterOperator.EQ, sShowInclude === "X" ? true : false));
            aFilters.push(new Filter("ShowExpired", FilterOperator.EQ, sShowExpired === "X" ? true : false));

            this.removeAllColumns();
            this._CallODataV2("READ", "/ZC_PROJECTED_FG_INV", aFilters, {}, {}).then(function (oResponse) {
                var aResults = [];
                if (oResponse.results[0]) {
                    aResults = JSON.parse(oResponse.results[0].DynamicData);
                }
                if (aResults.length > 0) {
                    this.getModel("local").setProperty("/resultSet", aResults);
                    this._renderingColumns(aResults[0]);
                } else {
                    MessageBox.error(this.getModel("i18n").getResourceBundle().getText("NoData"));
                }
            }.bind(this), function (oError) {
                MessageBox.error(oError);
            }.bind(this));
        },

        _renderingColumns: function (object) {
            var aEndColumns = [];
            for (const key in object) {
                // 排除不需要显示的列
                if (key === "BaseUnit" || key === "Currency") {
                    continue;
                }
                var oColumn, oLabel, oTemplate, sTextAlign, bvisible;
                switch (key) {
                    // 需要根据条件显示的列
                    // case "IndustryStandardName":
                    //     bvisible = "{= ${local>/filter/ShowInformation} === 'X'}";
                    //     break;
                    // case "FinalProduct":
                    //     bvisible = "{= ${local>/filter/ShowDEMAND} === 'X'}";
                    //     break;
                    default:
                        bvisible = true;
                        break;
                }
                switch (key) {
                    // 右对齐的列
                    case "PastQty":
                    case "TotalQty":
                    case "StockQty":
                    case "OFQty":
                    case "SOQty":
                    case "PlanQty":
                    case "SOOFQty":
                    case "SOPlanQty":
                    case "OFPlanQty":
                        sTextAlign = "End";
                        break;
                    default:
                        sTextAlign = "Begin"
                        break;
                }

                oLabel = new Label({ text: "{i18n>" + key + "}" });
                if (key.substring(0, 3) === "YMD" || key.substring(0, 2) === "YW" || key.substring(0, 2) === "YM") {
                    if (key.substring(0, 2) === "YM" && key.substring(0, 3) !== "YMD") {
                        oLabel = new Label({ text: key.substring(0, 8) });
                    } else {
                        oLabel = new Label({ text: key });
                    }
                    sTextAlign = "End";
                }
                if (sTextAlign === "End") {
                    oTemplate = new Text({
                        text: {
                            path: "local>" + key,
                            formatter: function (n) {
                                if (n) {
                                    var sign = "";
                                    if (typeof n === "string") {
                                        var bNegative = n.endsWith("-");
                                        if (bNegative) {
                                            n = "-" + n.substring(0, n.length - 1);
                                        }
                                    }
                                    var num = Number(n).toFixed(3);
                                    if (num < 0) {
                                        num = num.substring(1);
                                        sign = "-";
                                    }
                                    var re = /\d{1,3}(?=(\d{3})+$)/g;
                                    var n1 = num.toString().replace(/^(\d+)((\.\d+)?)$/, function (s, s1, s2) {
                                        return s1.replace(re, "$&,") + s2;
                                    });
                                    if (sign === "-") {
                                        n1 = sign + n1;
                                    }
                                    return n1;
                                } else {
                                    return n;
                                }
                            }
                        },
                        wrapping: false
                    });
                } else {
                    oTemplate = new Text({
                        text: "{local>" + key + "}",
                        wrapping: false
                    });
                }

                oColumn = new UIColumn({
                    width: "10rem",
                    label: oLabel,
                    hAlign: sTextAlign,
                    visible: bvisible,
                    template: oTemplate
                });
                if (key === "FutureQty" || key === "TotalQty") {
                    aEndColumns.push(oColumn);
                } else {
                    this._oTable.addColumn(oColumn);
                }
            }
            aEndColumns.forEach(oColumn => {
                this._oTable.addColumn(oColumn);
            });
        },

        removeAllColumns: function () {
            this._oTable.removeAllColumns();
            this.getModel("local").setProperty("/resultSet", []);
        },

        onExport: function () {
            var oTable = this.byId("idListTable");
            var sFileName = this.getModel("i18n").getResourceBundle().getText("title");
            this._exportExcel(oTable, sFileName);
        },

        _exportExcel: function (oTable, sFileName) {
            var sPath = oTable.getBindingPath("rows");
            var aExcelSet = this.getModel("local").getProperty(sPath) ? this.getModel("local").getProperty(sPath) : [];
            var aExcelCol = [];
            var aTableCol = oTable.getColumns();
            for (var i = 0; i < aTableCol.length; i++) {
                if (aTableCol[i].getVisible()) {
                    var sLabelText = aTableCol[i].getAggregation("label").getText();
                    var sType, sTextAlign, bDelimiter, iScale;
                    var sFieldName = aTableCol[i].getAggregation("template").mBindingInfos.text.parts[0].path;
                    switch (sFieldName) {
                        //  Number 分隔符
                        case "PastQty":
                        case "TotalQty":
                        case "StockQty":
                        case "OFQty":
                        case "SOQty":
                        case "PlanQty":
                        case "SOOFQty":
                        case "SOPlanQty":
                        case "OFPlanQty":
                        case "PastQty":
                        case "TotalQty":
                            sType = sap.ui.export.EdmType.Number;
                            bDelimiter = true;
                            iScale = 3;
                            sTextAlign = "End";
                            break;
                        //  Number 不分隔符
                        // case "MaterialPlannedDeliveryDurn":
                        //     sType = sap.ui.export.EdmType.Number;
                        //     bDelimiter = true;
                        //     sTextAlign = "End";
                        //     break;
                        default:
                            sType = sap.ui.export.EdmType.String;
                            sTextAlign = "Begin";
                            break;
                    }
                    if (sFieldName.substring(0, 3) === "YMD" || sFieldName.substring(0, 2) === "YW" || sFieldName.substring(0, 2) === "YM") {
                        sType = sap.ui.export.EdmType.Number;
                        bDelimiter = true;
                        iScale = 3;
                        sTextAlign = "End";
                    }
                    var oExcelCol = {
                        label: sLabelText,
                        type: sType,
                        property: aTableCol[i].getAggregation("template").getBindingPath("text"),
                        width: parseFloat(aTableCol[i].getWidth()),
                        textAlign: sTextAlign,
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
                fileName: sFileName + "_" + this.getCurrentDateTime() + ".xlsx"
            };
            // export excel file
            new Spreadsheet(oSettings).build();
        },
    });
});