sap.ui.define([
    "./Base",
    "../model/formatter",
    "sap/m/BusyDialog",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/export/Spreadsheet"
], function (Base, formatter, BusyDialog, MessageBox, Filter, FilterOperator, Spreadsheet) {
    "use strict";

    return Base.extend("mm.zsupplierresdlvdatereport.controller.Main", {

        formatter: formatter,

        onInit: function () {
            this._myBusyDialog = new BusyDialog();
            this._UserInfo = sap.ushell.Container.getService("UserInfo");
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
                if (!aAllAccessBtns.some(btn => btn.AccessId === "zsupplierresdlvdatereport-View")) {
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
                        View: aAllAccessBtns.some(btn => btn.AccessId === "zsupplierresdlvdatereport-View")
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

        onBeforeRebindTable: function (oEvent) {
            var aFilters = oEvent.getParameter("bindingParams").filters;
            aFilters.push(new Filter("UserEmail", FilterOperator.EQ, this._UserInfo.getEmail()));
        },

        onBeforeExport: function (oEvent) {
            var mExcelSettings = oEvent.getParameter("exportSettings");
            var sFileName = this.getModel("i18n").getResourceBundle().getText("appTitle");
            this._exportExcel(mExcelSettings, sFileName);
        },

        _exportExcel: function (mExcelSettings, sFileName) {
            mExcelSettings.workbook.columns.forEach(function (oColumn) {
                switch (oColumn.property) {
                    //  日期类型 (Date)
                    case "ETA_HK_Date":
                    case "ShipmentDate":
                    case "CreationDate":
                    case "PORequiredDate":
                    case "GRDate":
                        oColumn.type = sap.ui.export.EdmType.Date;
                        break;
                    //  金额类型 (Amount) - 带单位参考
                    case "NetAmount":
                    case "UnitPrice":
                        oColumn.type = sap.ui.export.EdmType.Number;
                        oColumn.scale = 2;
                        oColumn.delimiter = true;
                        oColumn.unitProperty = "DocumentCurrency";
                        oColumn.hAlign = "End";
                        break;
                    //  金额类型 (Amount) - 带单位参考
                    case "GRAmountUSD":
                        oColumn.type = sap.ui.export.EdmType.Number;
                        oColumn.scale = 2;
                        oColumn.delimiter = true;
                        oColumn.unitProperty = "USDCurrency";
                        oColumn.hAlign = "End";
                        break;
                    //  数量类型 (Quantity) - 带单位参考
                    case "ShipmentQty":
                    case "TotalShipmentQty":
                    case "OrderQuantity":
                    case "PORemainingQty":
                    case "NetWeight":
                    case "GRQuantity":
                    case "InspectionQty":
                    case "AcceptedQty":
                    case "DefectiveQty":
                        oColumn.type = sap.ui.export.EdmType.Number;
                        oColumn.scale = 3;
                        oColumn.delimiter = true;
                        oColumn.unitProperty = "OrderUnit";
                        oColumn.hAlign = "End";
                        break;
                }
            });
            mExcelSettings.fileName = sFileName + "_" + this.getCurrentDateTime();
        }
    });
});