sap.ui.define([
    "./Base",
    "../model/formatter",
    "sap/m/BusyDialog",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/Fragment",
    "sap/ui/export/Spreadsheet",
], (Base, formatter, BusyDialog, MessageBox, MessageToast, Filter, FilterOperator, Fragment, Spreadsheet) => {
    "use strict";

    return Base.extend("fico.vat.controller.Main", {
        formatter: formatter,
        onInit() {
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
                if (!aAllAccessBtns.some(btn => btn.AccessId === "vat-View")) {
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
                        View: aAllAccessBtns.some(btn => btn.AccessId === "vat-View"),
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
            let filters = oEvent.getParameters().bindingParams.filters;
            let oSmartFilterBar = this.byId("idSmartFilterBar");
            let oRange = this.byId("idDate");
            if (oRange.getFrom()) {
                var sfromDate = `${oRange.getFrom().getFullYear()}${(oRange.getFrom().getMonth() + 1).toString().padStart(2, "0")}${oRange.getFrom().getDate().toString().padStart(2, "0")}`;
                var stoDate = `${oRange.getTo().getFullYear()}${(oRange.getTo().getMonth() + 1).toString().padStart(2, "0")}${oRange.getTo().getDate().toString().padStart(2, "0")}`;
                let oStartdate = new sap.ui.model.Filter({
                    path: "PostingDate",
                    operator: "BT",
                    value1: sfromDate,
                    value2: stoDate
                });
                filters.push(oStartdate);
            };
            let sEmail = this._UserInfo.getEmail() === undefined ? "" : this._UserInfo.getEmail();
            filters.push(new sap.ui.model.Filter("UserEmail", "EQ", sEmail));
        },

        onBeforeExport: function (oEvent) {
            var mExcelSettings = oEvent.getParameter("exportSettings");
            var sFileName = this.getModel("i18n").getResourceBundle().getText("appTitle");
            this._exportExcel(mExcelSettings, sFileName);
        },
        
        _exportExcel: function (mExcelSettings, sFileName) {
            mExcelSettings.workbook.columns.forEach(function (oColumn) {
                switch (oColumn.property) {
                    //  Date
                    case "InvoiceDate":
                        oColumn.type = sap.ui.export.EdmType.Date;
                        break;
                    case "OriginalAmount":
                        oColumn.type = sap.ui.export.EdmType.Number;
                        oColumn.delimiter = true;
                        oColumn.scale = 2;
                        oColumn.textAlign = "End";
                        break;
                    case "BaseAmount":
                        oColumn.type = sap.ui.export.EdmType.Number;
                        oColumn.delimiter = true;
                        oColumn.scale = 2;
                        oColumn.textAlign = "End";
                        break;
                    case "TaxAmount":
                        oColumn.type = sap.ui.export.EdmType.Number;
                        oColumn.delimiter = true;
                        oColumn.scale = 2;
                        oColumn.textAlign = "End";
                        break;
                }
            });
            mExcelSettings.fileName = sFileName + "_" + this.getCurrentDateTime();
        }
    });
});