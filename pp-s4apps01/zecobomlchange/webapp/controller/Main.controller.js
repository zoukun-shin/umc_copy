sap.ui.define([
    "./Base",
    "../model/formatter",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox"
], function (Base, formatter, Filter, FilterOperator, MessageBox) {
    "use strict";

    return Base.extend("pp.zecobomlchange.controller.Main", {
        formatter: formatter,

        onInit: function () {
            this._LocalData = this.getOwnerComponent().getModel("local");
            this._oDataModel = this.getOwnerComponent().getModel();
            this.getRouter().getRoute("Main").attachMatched(this._initialize, this);
        },

        _initialize: function () {
            this._UserInfo = sap.ushell.Container.getService("UserInfo");
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
                if (!aAllAccessBtns.some(btn => btn.AccessId === "zecobomlchange-View")) {
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
                        View: aAllAccessBtns.some(btn => btn.AccessId === "zecobomlchange-View")
                    },
                    data: {
                        PlantSet: context._AssignPlant,
                        CompanySet: context._AssignCompany,
                        SalesOrgSet: context._AssignSalesOrg,
                        PurchOrgSet: context._AssignPurchOrg,
                        RoleSet: context._AssignRole
                    }
                });

                // 默认带出操作人所属权限工厂，多个工厂时，升序排序后带出来第一个
                this._setDefaultPlant(context._AssignPlant);
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

        _setDefaultPlant: function (aPlantSet) {
            if (!aPlantSet || aPlantSet.length === 0) {
                return;
            }

            //  行项目字段名为Plant，与CompanySet-CompanyCode同结构 
            var aPlants = aPlantSet.map(function (oData) {
                return oData.Plant;
            }).sort();

            var sDefaultPlant = aPlants[0];

            this.byId("SFBECOBOMLChange").setFilterData({ Plant: sDefaultPlant }, true);
        },

        onSearch: function () {
            // 纯查询报表，目前无需联动按钮可见性等逻辑
        },

        onBeforeRebindTable: function (oEvent) {
            var mBindingParams = oEvent.getParameter("bindingParams");

            var bHasError = false;
            var sMessage = "";
            var sPlant = this.byId("SFBECOBOMLChange").getFilterData().Plant;
            var aAuthorityPlantSet = this.getModel("local").getProperty("/authorityCheck/data/PlantSet");

            if (!aAuthorityPlantSet.some(data => data.Plant === sPlant)) {
                bHasError = true;
                sMessage = sPlant;
            }

            if (bHasError) {
                MessageBox.error(this.getView().getModel("i18n").getResourceBundle().getText("noAuthorityPlant", [sMessage]));
                mBindingParams.preventTableBind = true;
                return;
            }

            var oDateRange = this.byId("idValidDateRange");
            if (oDateRange) {
                var oDateFrom = oDateRange.getDateValue();
                var oDateTo = oDateRange.getSecondDateValue();

                if (oDateFrom && oDateTo) {
                    mBindingParams.filters.push(
                        new Filter("ValidDate", FilterOperator.BT, oDateFrom, oDateTo)
                    );
                }
            }

            // 除工厂之外，必须再输入至少一个检索条件
            var oFilterData = this.byId("SFBECOBOMLChange").getFilterData();
            console.log("oFilterData", oFilterData);

            var bHasExtraFilter = this._hasFilterValue(oFilterData.BillOfMaterialComponent)
                || this._hasFilterValue(oFilterData.MRPController)
                || oDateRange.getDateValue()
                || this._hasFilterValue(oFilterData.OldPartsManagement);

            if (!bHasExtraFilter) {
                MessageBox.error(
                    this.getModel("i18n").getResourceBundle().getText("needAnotherFilter")
                );
                mBindingParams.preventTableBind = true;
                return;
            }


        },

        _hasFilterValue: function (vValue) {
            if (vValue === undefined || vValue === null || vValue === "") {
                return false;
            }
            if (Array.isArray(vValue)) {
                return vValue.length > 0;
            }
            return true;
        },

        onBeforeExport: function (oEvent) {
            var mExcelSettings = oEvent.getParameter("exportSettings");
            var sFileName = this.getModel("i18n").getResourceBundle().getText("appTitle");
            this._exportExcel(mExcelSettings, sFileName);
        },

        _exportExcel: function (mExcelSettings, sFileName) {
            // 日期列格式转换：把 /Date(...)/ 原始值导出为 yyyy/MM/dd
            mExcelSettings.workbook.columns.forEach(function (oColumn) {
                switch (oColumn.property) {
                    case "ValidityStartDate":
                    case "ValidityEndDate":
                    case "ValidDate":
                        oColumn.type = sap.ui.export.EdmType.Date;
                        oColumn.format = "yyyy/MM/dd";
                        break;
                }
            });
            // 下载文件名：程序名 + 时间戳，与其他报表统一
            mExcelSettings.fileName = sFileName + "_" + this.getCurrentDateTime();
        }
    });
});