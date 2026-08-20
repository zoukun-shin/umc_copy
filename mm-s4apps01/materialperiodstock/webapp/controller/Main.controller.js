sap.ui.define([
    "./Base",
    "sap/ui/core/mvc/Controller"
], (Base, Controller) => {
    "use strict";

    return Base.extend("mm.materialperiodstock.controller.Main", {
        onInit() {
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
                if (!aAllAccessBtns.some(btn => btn.AccessId === "materialperiodstock-View")) {
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
                        View: aAllAccessBtns.some(btn => btn.AccessId === "materialperiodstock-View")
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
            var oBindingParams = oEvent.getParameter("bindingParams");
            oBindingParams.parameters = oBindingParams.parameters || {};
            var oSmartTable = oEvent.getSource();
            var oSmartFilterBar = this.byId(oSmartTable.getSmartFilterId());

            //年月
            var oCustomControl_YearMonth = oSmartFilterBar.getControlByKey("YearMonth");
            var vYearMonth = oCustomControl_YearMonth.getValue();
            oBindingParams.filters.push(new sap.ui.model.Filter("YearMonth", "EQ", vYearMonth));

            //分解组件
            var oCustomControl_Explode = oSmartFilterBar.getControlByKey("BomExplosion");
            var vExplode = oCustomControl_Explode.getSelected() ? "X" : "";;
            oBindingParams.filters.push(new sap.ui.model.Filter("BomExplosion", "EQ", vExplode));

            // 用于数据权限过滤
            var sEmail = this._UserInfo.getEmail() === undefined ? "" : this._UserInfo.getEmail();
            oBindingParams.filters.push(new sap.ui.model.Filter("UserEmail", "EQ", sEmail));
        },

        onBeforeExport: function (oEvent) {
            var mExcelSettings = oEvent.getParameter("exportSettings");
            mExcelSettings.workbook.columns.forEach(function (oColumn) {
                switch (oColumn.property) {
                    case "MatlWrhsStkQtyInMatlBaseUnit":
                    case "NetWeight":
                        oColumn.type = sap.ui.export.EdmType.Number;
                        oColumn.delimiter = true;
                        oColumn.scale = 3;
                        oColumn.textAlign = "End";
                        break;
                    case "UnitPrice":
                    case "TotalAmountCNY":
                    case "TotalAmountUSD":
                        oColumn.type = sap.ui.export.EdmType.Number;
                        oColumn.delimiter = true;
                        oColumn.scale = 6;
                        oColumn.textAlign = "End";
                        break;
                }
            });
            var sFileName = this.getModel("i18n").getResourceBundle().getText("appTitle");
            mExcelSettings.fileName = sFileName + "_" + this.getCurrentDateTime();
        }
    });
});