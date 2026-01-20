sap.ui.define([
    "./Base",
    "sap/ui/core/UIComponent",
    "sap/m/MessageBox"
], function (Base, UIComponent, MessageBox) {
    "use strict";

    return Base.extend("pp.zalterandmainmater.controller.Main", {
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
                if (!aAllAccessBtns.some(btn => btn.AccessId === "zalterandmainmater-View")) {
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
                        View: aAllAccessBtns.some(btn => btn.AccessId === "zalterandmainmater-View")
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

        onsMrilterBarInitialized: function (oEvent) {
            var oSmartFilterBar = oEvent.getSource();
            oSmartFilterBar.setFilterData({
                Alternative2Main: false,
                Main2Alternative: false
            });
        },

        onBeforeRebindTable: function (oEvent) {
            var filters = oEvent.getParameters().bindingParams.filters;
            if (!filters) {
                filters = [];
            }

            var oSmartFilterBar = this.byId("idSmartFilterBar");
            var sPlant = oSmartFilterBar.getFilterData().Plant;
            var aAuthorityPlantSet = this.getView().getModel("local").getProperty("/authorityCheck/data/PlantSet");
            if (!aAuthorityPlantSet.some(data => data.Plant === sPlant)) {
                MessageBox.error(this.getView().getModel("i18n").getResourceBundle().getText("noAuthorityPlant", [sPlant]));    

                var oFiltersPlant = filters[0].aFilters.find(Filters => Filters.sPath === "Plant");
                if (oFiltersPlant) {
                    oFiltersPlant.oValue1 = '';
                }
            }

            var sValidityStartDate = this.getModel("local").getProperty("/ValidityStartDateValue");
            var oValidityStartDate = new sap.ui.model.Filter({
                path: "ValidityStartDate",
                operator: "EQ",
                value1: sValidityStartDate
            });
            filters.push(oValidityStartDate);

            var sValidityEndDate = this.getModel("local").getProperty("/ValidityEndDateValue");
            var oValidityEndDate = new sap.ui.model.Filter({
                path: "ValidityEndDate",
                operator: "EQ",
                value1: sValidityEndDate
            });
            filters.push(oValidityEndDate);

            var iSelectedIndex = this.byId("idRBG1").getSelectedIndex();

            if (iSelectedIndex === 0) {
                var sAlternative2Main = true;
            }else{
                sAlternative2Main = false;
            }

            var oAlternative2Main = new sap.ui.model.Filter({
                path: "Alternative2Main",
                operator: "EQ",
                value1: sAlternative2Main
            });
             filters.push(oAlternative2Main);
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
                    case "ValidityEndDate":
                        oColumn.type = sap.ui.export.EdmType.Date;
                        break;
                    case "BOMQty":
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
