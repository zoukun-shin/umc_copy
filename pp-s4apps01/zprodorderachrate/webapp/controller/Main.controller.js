sap.ui.define([
    "./Base",
    "../model/formatter",
    "sap/m/BusyDialog",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/table/Column",
    "sap/m/Label",
    "sap/m/Text",
    "sap/ui/export/Spreadsheet"
], function (Base, formatter, BusyDialog, MessageBox, Filter, FilterOperator, UIColumn, Label, Text, Spreadsheet) {
    "use strict";

    return Base.extend("pp.zprodorderachrate.controller.Main", {
        formatter: formatter,
        
        onInit: function () {
            this._oTable = this.byId("idTable");
            this._UserInfo = sap.ushell.Container.getService("UserInfo");
            this.getRouter().getRoute("RouteMain").attachMatched(this._initialize, this);
        },

        _initialize: function () {
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
                if (!aAllAccessBtns.some(btn => btn.AccessId === "zprodorderachrate-View")) {
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
                        Export: aAllAccessBtns.some(btn => btn.AccessId === "zprodorderachrate-Export")
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

        onSearch: function () {
            var aFilters = this.byId("idSmartFilterBar").getFilters();

            var bSelected = this.byId("idCB1").getSelected();
            aFilters.push(new Filter("DisplayFG", FilterOperator.EQ, bSelected));
            this.getModel("local").setProperty("/filter/DisplayFG", bSelected);

            var iSelectedIndex = this.byId("idRBG1").getSelectedIndex();
            aFilters.push(new Filter("DisplayMode", FilterOperator.EQ, iSelectedIndex));
            if (iSelectedIndex === 0) {
                this.getModel("local").setProperty("/filter/DisplayBaseOrderEntryQty", true);
                this.getModel("local").setProperty("/filter/DisplayBaseProductionQty", false);
            } else {
                this.getModel("local").setProperty("/filter/DisplayBaseOrderEntryQty", false);
                this.getModel("local").setProperty("/filter/DisplayBaseProductionQty", true);
            }

			var oDateRange = this.byId("idDateRangeSelection");
			if (oDateRange.getFrom()) {
				var splitStart = `${oDateRange.getFrom().getFullYear()}${(oDateRange.getFrom().getMonth() + 1).toString().padStart(2, "0")}${oDateRange.getFrom().getDate().toString().padStart(2, "0")}`;
				var splitEnd = `${oDateRange.getTo().getFullYear()}${(oDateRange.getTo().getMonth() + 1).toString().padStart(2, "0")}${oDateRange.getTo().getDate().toString().padStart(2, "0")}`;
			}

			if (splitStart) {
				aFilters.push(new Filter("MfgOrderPlannedStartDate", FilterOperator.BT, splitStart, splitEnd));
			}

            this.removeAllColumns();
            this._loadAllData("/ProdOrderAchRate", aFilters).then(function (aAllData) {
                var aResults = [];

                if (aAllData[0]) {
                    aResults = JSON.parse(aAllData[0].DynamicData);
                }
                if (aResults.length > 0) {
                    this.getModel("local").setProperty("/resultSet", aResults);
                    this._renderingColumns(aResults[0]);
                } else {
                    MessageBox.error(this.getModel("i18n").getResourceBundle().getText("noData"));
                }
            }.bind(this), function (oError) {
                MessageBox.error(oError);
            }.bind(this));
        },

        _renderingColumns: function (object) {
            for (const key in object) {
                var oColumn, oLabel, oTemplate, sTextAlign, bVisible, sWidth;
                switch (key) {
                    case "ManufacturingOrderType":
                    case "RequestQty":
                    case "ActualCompleteQty":
                    case "OrderCompleteRate":
                        bVisible = "{= ${local>/filter/DisplayBaseOrderEntryQty} === true}";
                        break;
                    case "Material":
                        bVisible = "{= ${local>/filter/DisplayBaseProductionQty} === true && ${local>/filter/DisplayFG} === true}";
                        break;
                    case "Customer":
                    case "Product":
                    case "ProductionUnit":
                    case "Item":
                    case "TotalQty": 
                        bVisible = "{= ${local>/filter/DisplayBaseProductionQty} === true}";
                        break;
                    default:
                        bVisible = true;
                        break;
                }
                switch (key) {
                    case "RequestQty":
                    case "ActualCompleteQty":
                    case "TotalQty":
                        sTextAlign = "End";
                        break;
                    default:
                        sTextAlign = "Begin"
                        break;
                }
                switch (key) {
                    case "Material":
                    case "Product":
                        sWidth = "15rem";
                        break;
                    default:
                        sWidth = "10rem";
                        break;
                }
                oLabel = new Label({ text: "{i18n>" + key + "}" });
                if (key.substring(0, 3) === "Dyn") {
                    oLabel = new Label({ text: key.substring(3, 11) });
                    sTextAlign = "End";
                }

                oTemplate = new Text({
                    text: "{local>" + key + "}",
                    wrapping: false
                });

                oColumn = new UIColumn({
                    width: sWidth,
                    label: oLabel,
                    hAlign: sTextAlign,
                    visible: bVisible,
                    template: oTemplate
                });

                this._oTable.addColumn(oColumn);
            }
        },

        removeAllColumns: function () {
            this._oTable.removeAllColumns();
            this.getModel("local").setProperty("/resultSet", []);
        },

        onExport: function () {
            var oTable = this.byId("idTable");
            var aExcelSet = this.getModel("local").getProperty("/resultSet");
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
                        case "Plant": 
                        case "ProductionSupervisor": 
                        case "MRPResponsible": 
                        case "Customer": 
                        case "Material":
                        case "Product":
                        case "ProductionUnit":
                        case "Item":
                        case "ManufacturingOrderType":
                        case "OrderCompleteRate":
                            sType = sap.ui.export.EdmType.String;
                            sTextAlign = "Begin";
                            break;
                        default:
                            sType = sap.ui.export.EdmType.Number;
                            sTextAlign = "End";
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
            // Export excel file
            new Spreadsheet(oSettings).build();
        }
    });
});
