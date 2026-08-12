sap.ui.define([
    "./Base",
    "../model/formatter",
    "sap/ui/core/UIComponent"
], function (Base, formatter, UIComponent) {
    "use strict";

    return Base.extend("pp.zcomponentusagelist.controller.Main", {
        formatter: formatter,

        onInit: function () {
            this._UserInfo = sap.ushell.Container.getService("UserInfo");
            this.getRouter().getRoute("Main").attachMatched(this._initialize, this);
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
                if (!aAllAccessBtns.some(btn => btn.AccessId === "zcomponentusagelist-View")) {
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
                        View: aAllAccessBtns.some(btn => btn.AccessId === "zcomponentusagelist-View")
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
            // //设置默认值
            oSmartFilterBar.setFilterData({
                NoDisplayNonProduct: false,
                DisplayPurchasingInfo: false
            });
        },

        // onSelect: function (oEvent) {
        //     var sId = oEvent.getSource().getId();
        //     var bSelected = oEvent.getSource().getSelected();
        //     this.toggleCheckBox(sId, bSelected);
        // },

        // toggleCheckBox: function (sId, bSelected) {
        //     if (sId.includes("idCB2")) {
        //             this.getModel("local").setProperty("/displayPurchasingInfo",bSelected);
        //     }

        //     if (sId.includes("idCB3")) {
        //             this.getModel("local").setProperty("/displayComponentQtyInBaseUnit",bSelected);
        //     }
        // },

        onBeforeRebindTable: function (oEvent) {
            // 获取表格对象
            // var oTable = this.byId("idTable");
            // 获取 DisplayPurchasingInfo 的值
            // var oSmartFilterBar = this.byId("idSmartFilterBar");
            // var sDisplayPurchasingInfo = oSmartFilterBar.getFilterData().DisplayPurchasingInfo;
            // var bDisplayPurchasingInfo = this.byId("idCB2").getSelected();
            // 动态显示或隐藏列
            // var oColumns = oTable.getColumns();
            // oColumns.forEach(function (oColumn) {
            //     if (oColumn.getSortProperty() === "SupplierMaterialNumber" || oColumn.getSortProperty() === "ProductManufacturerNumber") {
            //         oColumn.setVisible(bDisplayPurchasingInfo);
            //     }
            // });

            var bDisplayPurchasingInfo = this.byId("idCB2").getSelected();
            var bDisplayComponentQtyInBaseUnit = this.byId("idCB3").getSelected();
            this.getModel("local").setProperty("/displayPurchasingInfo",bDisplayPurchasingInfo);
            this.getModel("local").setProperty("/displayComponentQtyInBaseUnit",bDisplayComponentQtyInBaseUnit);

            // 根据选择框，添加过滤条件传值到后端
            var oBindingParams = oEvent.getParameter("bindingParams");
            var filters = oBindingParams.filters;
            if (!filters) {
                filters = [];
            }

            var sNoDisplayNonProduct = this.byId("idCB1").getSelected();
            if (sNoDisplayNonProduct === true) {
                var oIndicator1Filter = new sap.ui.model.Filter({
                    path: "NoDisplayNonProduct",
                    operator: "EQ",
                    value1: sNoDisplayNonProduct
                });
                filters.push(oIndicator1Filter);
            }

            if (bDisplayComponentQtyInBaseUnit === true) {
                var oDisplayComponentQtyInBaseUnit = new sap.ui.model.Filter({
                    path: "DisplayComponentQtyInBaseUnit",
                    operator: "EQ",
                    value1: bDisplayComponentQtyInBaseUnit
                });
                filters.push(oDisplayComponentQtyInBaseUnit);

                //当不勾选，后端不取值；勾选后，后端才取值 需要下列逻辑
                if (oBindingParams.parameters && oBindingParams.parameters.select) {
                    var sSelect = oBindingParams.parameters.select;

                    if (!sSelect.includes("ComponentQuantityInBaseUoM")) {
                        sSelect += ",ComponentQuantityInBaseUoM";
                    }

                    if (!sSelect.includes("BillOfMaterialItemBaseUnit")) {
                        sSelect += ",BillOfMaterialItemBaseUnit";
                    }

                    oBindingParams.parameters.select = sSelect;
                }
            }
        },

        onUITableRowsUpdated: function (oEvent) {
            var bDisplayPurchasingInfo = this.byId("idCB2").getSelected();
            var bDisplayComponentQtyInBaseUnit = this.byId("idCB3").getSelected();
            this.getModel("local").setProperty("/displayPurchasingInfo",bDisplayPurchasingInfo);
            this.getModel("local").setProperty("/displayComponentQtyInBaseUnit",bDisplayComponentQtyInBaseUnit);
        },

        // ADD BEGIN BY XINLEI XU 2025/07/29
        onBeforeExport: function (oEvent) {
            var mExcelSettings = oEvent.getParameter("exportSettings");
            var sFileName = this.getModel("i18n").getResourceBundle().getText("appTitle");
            this._exportExcel(mExcelSettings, sFileName);
        },

        _exportExcel: function (mExcelSettings, sFileName) {
            mExcelSettings.workbook.columns.forEach(function (oColumn) {
                switch (oColumn.property) {
                    //  Date
                    case "HighLevelMatValidityStartDate":
                    case "HighLevelMatValidityEndDate":
                        oColumn.type = sap.ui.export.EdmType.Date;
                        break;
                    case "BillOfMaterialItemQuantity":
                        oColumn.type = sap.ui.export.EdmType.Number;
                        oColumn.delimiter = true;
                        oColumn.scale = 2;
                        oColumn.textAlign = "End";
                        break;
                    case "ComponentQuantityInBaseUoM":
                    case "BomHeaderQuantityInBaseUnit":
                        oColumn.type = sap.ui.export.EdmType.Number;
                        oColumn.textAlign = "End";
                        break;
                }
            });
            mExcelSettings.fileName = sFileName + "_" + this.getCurrentDateTime();
        }
        // ADD END BY XINLEI XU 2025/07/29
    });
});
