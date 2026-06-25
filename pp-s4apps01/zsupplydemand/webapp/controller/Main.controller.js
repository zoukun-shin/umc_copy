sap.ui.define([
    "./Base",
    "../model/formatter",
    "sap/ui/core/UIComponent",
    "sap/m/MessageBox",
	"sap/ui/core/date/UI5Date"
], function (Base, formatter, UIComponent, MessageBox, UI5Date) {
    "use strict";

    return Base.extend("pp.zsupplydemand.controller.Main", {
        formatter: formatter,
        
        onInit: function () {
            this._UserInfo = sap.ushell.Container.getService("UserInfo");
            this.getRouter().getRoute("RouteMain").attachMatched(this._initialize, this);
        },

        _initialize: function () {
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
                if (!aAllAccessBtns.some(btn => btn.AccessId === "zsupplydemand-View")) {
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
                        View: aAllAccessBtns.some(btn => btn.AccessId === "zsupplydemand-View")
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

        getRouter: function () {
            return UIComponent.getRouterFor(this);
        },

        onSmartFilterBarInitialized: function (oEvent) {
            var oSmartFilterBar = oEvent.getSource();
            oSmartFilterBar.setFilterData({
                ProcessingType: "1"
            });
        },

        onBeforeRebindTable: function (oEvent) {
            
        },
        
        onBeforeExport: function (oEvent) {
            var oExcelSettings = oEvent.getParameter("exportSettings");
            var columns = oExcelSettings.workbook.columns;
            columns.forEach(function (oColumn) {
                switch (oColumn.property) {
                    case "MRPElementOpenQuantity": 
                    case "CurrentAvailableQuantity": 
                    case "FinalAvailableQuantity": 
                        oColumn.type = sap.ui.export.EdmType.Number;
                        oColumn.textAlign = "End";
                        break;
                    case "StartDate":
                    case "EndDate":
                        oColumn.type = sap.ui.export.EdmType.Date;
                        break;
                    default:
                        break;
                }
            });

            var sFileName = this.getModel("i18n").getResourceBundle().getText("appTitle");
            this.exportExcel(oExcelSettings, sFileName);
        },

        exportExcel: function (mExcelSettings, sFileName) {
            mExcelSettings.fileName = sFileName + "_" + this.getCurrentDateTime();
        }
    });
});
