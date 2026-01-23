sap.ui.define([
    "./Base",
    "../model/formatter",
    "sap/m/BusyDialog",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/Fragment",
    "sap/ui/table/Column",
    "sap/m/Label",
    "sap/m/Text",
    "sap/ui/export/Spreadsheet",
], (Base, formatter, BusyDialog, MessageBox, MessageToast, Filter, FilterOperator, Fragment, UIColumn, Label, Text, Spreadsheet) => {
    "use strict";

    return Base.extend("pp.modelshortage.controller.Main", {
        formatter: formatter,
        onInit() {
            this._oTable = this.byId("idTable");
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
                if (!aAllAccessBtns.some(btn => btn.AccessId === "modelshortage-View")) {
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
                        View: aAllAccessBtns.some(btn => btn.AccessId === "costingresult-View"),
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
            var that = this;
            var aFilters = this.byId("idSmartFilterBar").getFilters();
            var oDateRange = this.byId("idDate");
            if (oDateRange.getFrom()) {
                var splitStart = `${oDateRange.getFrom().getFullYear()}${(oDateRange.getFrom().getMonth() + 1).toString().padStart(2, "0")}${oDateRange.getFrom().getDate().toString().padStart(2, "0")}`;
                var splitEnd = `${oDateRange.getTo().getFullYear()}${(oDateRange.getTo().getMonth() + 1).toString().padStart(2, "0")}${oDateRange.getTo().getDate().toString().padStart(2, "0")}`;
                var iMonths =
                    (oDateRange.getTo().getFullYear() - oDateRange.getFrom().getFullYear()) * 12 +
                    (oDateRange.getTo().getMonth() - oDateRange.getFrom().getMonth());
                //最长间隔6个月
                if (iMonths > 6) {
                    MessageBox.error(this.getResourceBundle().getText("msg001"));
                    return;
                };
            };
            if (splitStart) {
                aFilters.push(new Filter("OrderDate", FilterOperator.BT, splitStart, splitEnd));
            };
            var sDisplayUnit = this.byId("cbDisplayUnit").getSelectedKey();
            aFilters.push(new Filter("DisplayUnit", FilterOperator.EQ, sDisplayUnit));
            var sDisplayUnassigned = this.byId("cbDisplayUnassigned").getSelectedKey();
            aFilters.push(new Filter("DisplayUnassigned", FilterOperator.EQ, sDisplayUnassigned));
            var sEmail = this._UserInfo.getEmail() === undefined ? "" : this._UserInfo.getEmail();
            aFilters.push(new Filter("UserEmail", FilterOperator.EQ, sEmail));

            this.removeAllColumns();
            this._CallODataV2("READ", "/ModelShortage", aFilters, {}, {}).then(function (oResponse) {
                var aResults = [];
                if (oResponse.results[0]) {
                    aResults = JSON.parse(oResponse.results[0].DynamicData);
                };
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
            var that = this;
            var oColumn, oLabel, oTemplate, sTextAlign, bvisible;
            for (const key in object) {
                bvisible = true;
                sTextAlign = "Begin"

                if (key.substring(0, 1) === "D" && key !== "Dispo") {
                    oLabel = new Label({ text: key.substring(1, 9) });
                    oTemplate = new Text({
                        text: {
                            path: "local>" + key,
                            formatter: function (sValue) {
                                if (!sValue || typeof sValue !== "string") {
                                    return "";
                                }
                                return sValue.substring(1);
                            }
                        },
                        wrapping: false
                    });

                    oTemplate.addEventDelegate({
                        onAfterRendering: function (oEvent) {
                            var oText = oEvent.srcControl;
                            var $cellInner = oText.$().closest(".sapUiTableCellInner");
                            if (!$cellInner.length) {
                                return;
                            }
                            $cellInner.removeClass("bgB bgO bgP bgR bgY");

                            var oCtx = oText.getBindingContext("local");
                            if (!oCtx) {
                                return;
                            }
                            var sValue = oCtx.getProperty(key);
                            if (!sValue || typeof sValue !== "string") {
                                return;
                            }
                            var sFirstChar = sValue.charAt(0);
                            //根据首字母判断颜色
                            if (sFirstChar === "B") {
                                $cellInner.addClass("bgB");
                            } else if (sFirstChar === "O") {
                                $cellInner.addClass("bgO");
                            } else if (sFirstChar === "P") {
                                $cellInner.addClass("bgP");
                            } else if (sFirstChar === "R") {
                                $cellInner.addClass("bgR");
                            } else if (sFirstChar === "Y") {
                                $cellInner.addClass("bgY");
                            } else if (sFirstChar === "D") {
                                $cellInner.addClass("bgD");
                            };
                        }
                    });
                } else {
                    oLabel = new Label({ text: "{i18n>" + key + "}" });
                    oTemplate = new Text({
                        text: "{local>" + key + "}",
                        wrapping: false
                    });
                };
                oColumn = new UIColumn({
                    width: "10rem",
                    label: oLabel,
                    hAlign: sTextAlign,
                    visible: bvisible,
                    template: oTemplate
                });
                this._oTable.addColumn(oColumn);
            };
        },

        removeAllColumns: function () {
            this._oTable.removeAllColumns();
            this.getModel("local").setProperty("/resultSet", []);
        },

        onExport: function () {
            var oTable = this.byId("idTable");
            var sFileName = this.getModel("i18n").getResourceBundle().getText("title");
            this._exportExcel(oTable, sFileName);
        },

        _exportExcel: function (oTable, sFileName) {
            var sPath = oTable.getBindingPath("rows");
            var aData = this.getModel("local").getProperty(sPath) || [];
            var aExcelSet = aData.map(function (oRow) {
                return Object.assign({}, oRow);
            });
            //日期列从第2个字符开始显示
            aExcelSet.forEach(function (oRow) {
                Object.keys(oRow).forEach(function (sKey) {
                    if (sKey.startsWith("D") && sKey !== "Dispo") {
                        var v = oRow[sKey];
                        if (typeof v === "string" && v.length > 0) {
                            oRow[sKey] = v.substring(1);
                        }
                    }
                });
            });

            var aExcelCol = [];
            var aTableCol = oTable.getColumns();
            for (var i = 0; i < aTableCol.length; i++) {
                if (aTableCol[i].getVisible()) {
                    var sLabelText = aTableCol[i].getAggregation("label").getText();
                    var sType, sTextAlign, bDelimiter, iScale;
                    var sFieldName = aTableCol[i].getAggregation("template").mBindingInfos.text.parts[0].path;
                    switch (sFieldName) {
                        default:
                            sType = sap.ui.export.EdmType.String;
                            sTextAlign = "Begin";
                            break;
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