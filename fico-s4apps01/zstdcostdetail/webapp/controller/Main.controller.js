sap.ui.define([
    "./Base",
    "../model/formatter",
    "sap/ui/core/UIComponent",
    "sap/m/MessageBox",
	"sap/ui/core/date/UI5Date"
], function (Base, formatter, UIComponent, MessageBox, UI5Date) {
    "use strict";

    return Base.extend("fico.zstdcostdetail.controller.Main", {
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
                if (!aAllAccessBtns.some(btn => btn.AccessId === "zstdcostdetail-View")) {
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
                        View: aAllAccessBtns.some(btn => btn.AccessId === "zstdcostdetail-View")
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

        },

        onBeforeRebindTable: function (oEvent) {
            var aFilters = oEvent.getParameters().bindingParams.filters;
            if (!aFilters) {
                aFilters = [];
            }

            var oSmartFilterBar = this.byId("idSmartFilterBar");
            var sPlant = oSmartFilterBar.getFilterData().Plant;
            var aAuthorityPlantSet = this.getView().getModel("local").getProperty("/authorityCheck/data/PlantSet");
            if (!aAuthorityPlantSet.some(data => data.Plant === sPlant)) {
                MessageBox.error(this.getView().getModel("i18n").getResourceBundle().getText("noAuthorityPlant", [sPlant]));    

                var oFiltersPlant = aFilters[0].aFilters.find(Filters => Filters.sPath === "Plant");
                if (oFiltersPlant) {
                    oFiltersPlant.oValue1 = '';
                }
                return;
            }

            var sCostingDate = this.getModel("local").getProperty("/CostingDate");
            var oCostingDate = new sap.ui.model.Filter({
                path: "CostingDate",
                operator: "EQ",
                value1: sCostingDate
            });
            aFilters.push(oCostingDate);

            // var sDate = oSmartFilterBar.getFilterData().CostingDate;
            // if (sDate) {
            //     //替换成0时区，而不是转化成0时区（为了保持日期不变）
            //     var oUTCDate = this.converttoUTCDateTime(sDate);
            //     var oCostingDate = aFilters[0].aFilters.find(Filters => Filters.sPath === "CostingDate");
            //     if (oCostingDate) {
            //         oCostingDate.oValue1 = oUTCDate;
            //     }
            // };

            // var sFiscalYear = this.byId("idFiscalYear").getDOMValue();
            // var oFiscalYear = new sap.ui.model.Filter({
            //     path: "FiscalYear",
            //     operator: "EQ",
            //     value1: sFiscalYear
            // });
            // aFilters.push(oFiscalYear);
        },

        onBeforeExport: function (oEvent) {
            var oExcelSettings = oEvent.getParameter("exportSettings");
            var columns = oExcelSettings.workbook.columns;
            columns.forEach(function (oColumn) {
                switch (oColumn.property) {
                    case "QuantityInBaseUnit": 
                        oColumn.type = sap.ui.export.EdmType.Number;
                        oColumn.scale = 3;
                        oColumn.textAlign = "End";
                        break;
                    case "AmountInCoCodeCrcy": 
                        oColumn.type = sap.ui.export.EdmType.Number;
                        oColumn.scale = 2;
                        oColumn.textAlign = "End";
                        break;
                    case "CostingDate":
                        oColumn.type = sap.ui.export.EdmType.Date;
                        break;
                    default:
                        break;
                }
            });

            var sFileName = this.getModel("i18n").getResourceBundle().getText("appTitle");
            this._exportExcel(oExcelSettings, sFileName);
        },

        _exportExcel: function (mExcelSettings, sFileName) {
            mExcelSettings.fileName = sFileName + "_" + this.getCurrentDateTime();
        }
    });
});
