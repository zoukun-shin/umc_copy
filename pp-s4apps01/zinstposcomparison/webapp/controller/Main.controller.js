sap.ui.define([
    "./Base",
    "sap/ui/core/UIComponent",
    "sap/m/MessageBox",
	"sap/ui/core/date/UI5Date"
], function (Base, UIComponent, MessageBox, UI5Date) {
    "use strict";

    return Base.extend("pp.zinstposcomparison.controller.Main", {
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

            var bSelected = this.byId("idCB1").getSelected();
            this.toggleCheckBox("idCB1", bSelected);
            bSelected = this.byId("idCB3").getSelected();
            this.toggleCheckBox("idCB3", bSelected);

            oContextBinding.requestObject().then(function (context) {
                var aAccessBtns = [],
                    aAllAccessBtns = [];
                if (context._AssignRole && context._AssignRole.length > 0) {
                    context._AssignRole.forEach(role => {
                        aAccessBtns.push(role._UserRoleAccessBtn);
                    });
                    aAllAccessBtns = aAccessBtns.flat();
                }
                if (!aAllAccessBtns.some(btn => btn.AccessId === "zinstposcomparison-View")) {
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
                        View: aAllAccessBtns.some(btn => btn.AccessId === "zinstposcomparison-View")
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

        onSelect: function (oEvent) {
            var sId = oEvent.getSource().getId();
            var bSelected = oEvent.getSource().getSelected();
            this.toggleCheckBox(sId, bSelected);
        },

        toggleCheckBox: function (sId, bSelected) {
            if (sId.includes("idCB3")) {
                this.byId("idHB1").setVisible(bSelected);
            }

            if (sId.includes("idCB1")) {
                this.clearTableData();

                if(bSelected){
                    this.getModel("local").setProperty("/showTable1",true);
                    this.getModel("local").setProperty("/showTable2",false);
                } else {
                    this.getModel("local").setProperty("/showTable1",false);
                    this.getModel("local").setProperty("/showTable2",true);
                }
            }  
        },

        clearTableData: function () {
            ["idSmartTable_1", "idSmartTable_2"].forEach(function (sId) {
                var oSmartTable = this.byId(sId);
                if (oSmartTable) {
                    var oTable = oSmartTable.getTable();
                    if (oTable) {
                        // 解绑
                        oTable.unbindRows();

                        // 重置SmartTable标题
                        var sHeader = this.getModel("i18n").getResourceBundle().getText("Results");
                        oSmartTable.setHeader(sHeader);
                        // 重置SmartTable动态列
                        var that = this;
                        oTable.getColumns().forEach(function (oColumn) {
                            var aCustomData = oColumn.getCustomData();
                            aCustomData.forEach(function (oCustomData) {
                                var oColumnKey = oCustomData.getValue();
                                if (oColumnKey && oColumnKey.columnKey === "BOMSubItemInstallationPoint_A") {
                                    var sValue = that.getModel("i18n").getResourceBundle().getText("BOMSubItemInstallationPoint_A");
                                    oColumn.setLabel(sValue);
                                }
                                if (oColumnKey && oColumnKey.columnKey === "BOMSubItemInstallationPoint_B") {
                                    var sValue = that.getModel("i18n").getResourceBundle().getText("BOMSubItemInstallationPoint_B");
                                    oColumn.setLabel(sValue);
                                }
                            });
                        });
                    }
                }
            }.bind(this));
        },

        onsMrilterBarInitialized: function (oEvent) {
            var oSmartFilterBar = oEvent.getSource();
            oSmartFilterBar.setFilterData({
                ValidityStartDate_A:UI5Date.getInstance(),
                ValidityStartDate_B:UI5Date.getInstance()
            });
        },

        onBeforeRebindTable: function (oEvent) {
            var filters = oEvent.getParameters().bindingParams.filters;
            if (!filters) {
                filters = [];
            }

            var oSmartFilterBar = this.byId("idSmartFilterBar");
            var sPlant = oSmartFilterBar.getFilterData().Plant_A;
            var aAuthorityPlantSet = this.getView().getModel("local").getProperty("/authorityCheck/data/PlantSet");
            if (!aAuthorityPlantSet.some(data => data.Plant === sPlant)) {
                MessageBox.error(this.getView().getModel("i18n").getResourceBundle().getText("noAuthorityPlant", [sPlant]));    

                var oFiltersPlant = filters[0].aFilters.find(Filters => Filters.sPath === "Plant_A");
                if (oFiltersPlant) {
                    oFiltersPlant.oValue1 = '';
                }
                return;
            }

            sPlant = oSmartFilterBar.getFilterData().Plant_B;
            if (!aAuthorityPlantSet.some(data => data.Plant === sPlant)) {
                MessageBox.error(this.getView().getModel("i18n").getResourceBundle().getText("noAuthorityPlant", [sPlant]));    

                var oFiltersPlant = filters[0].aFilters.find(Filters => Filters.sPath === "Plant_B");
                if (oFiltersPlant) {
                    oFiltersPlant.oValue1 = '';
                }
                return;
            }

            var sDate = oSmartFilterBar.getFilterData().ValidityStartDate_A;
            if (sDate) {
                //替换成0时区，而不是转化成0时区（为了保持日期不变）
                var oUTCDate = this.converttoUTCDateTime(sDate);
                var oFiltersPlant = filters[0].aFilters.find(Filters => Filters.sPath === "ValidityStartDate_A");
                if (oFiltersPlant) {
                    oFiltersPlant.oValue1 = oUTCDate;
                }
            };

            sDate = oSmartFilterBar.getFilterData().ValidityStartDate_B;
            if (sDate) {
                //替换成0时区，而不是转化成0时区（为了保持日期不变）
                oUTCDate = this.converttoUTCDateTime(sDate);
                var oFiltersPlant = filters[0].aFilters.find(Filters => Filters.sPath === "ValidityStartDate_B");
                if (oFiltersPlant) {
                    oFiltersPlant.oValue1 = oUTCDate;
                }
            };

            var bSelected = this.byId("idCB1").getSelected();
            var oOnlyInstPosComparison = new sap.ui.model.Filter({
                path: "OnlyInstPosComparison",
                operator: "EQ",
                value1: bSelected
            });
             filters.push(oOnlyInstPosComparison);

            bSelected = this.byId("idCB2").getSelected();
            var oBOMExplosionIsMultilevel = new sap.ui.model.Filter({
                path: "BOMExplosionIsMultilevel",
                operator: "EQ",
                value1: bSelected
            });
             filters.push(oBOMExplosionIsMultilevel);

            bSelected = this.byId("idCB3").getSelected();
            var oPrioPctDiscFollowUp = new sap.ui.model.Filter({
                path: "PrioPctDiscFollowUp",
                operator: "EQ",
                value1: bSelected
            });
             filters.push(oPrioPctDiscFollowUp);

            var iSelectedIndex = this.byId("idRBG1").getSelectedIndex();
            var oDiscOrFollowUp = new sap.ui.model.Filter({
                path: "DiscOrFollowUp",
                operator: "EQ",
                value1: iSelectedIndex
            });
             filters.push(oDiscOrFollowUp);

            iSelectedIndex = this.byId("idRBG2").getSelectedIndex();
            var oPriorityOrPercent = new sap.ui.model.Filter({
                path: "PriorityOrPercent",
                operator: "EQ",
                value1: iSelectedIndex
            });
             filters.push(oPriorityOrPercent);

            var oBinding = oEvent.getParameter("bindingParams");
            oBinding.events = {
                dataReceived: this.onDataReceived.bind(this)
            };
        },

        onDataReceived: function (oEvent) {
            var sValueA = this.byId("idSmartFilterBar").getFilterData().Material_A;
            var sValueB = this.byId("idSmartFilterBar").getFilterData().Material_B;

            var bSelected = this.byId("idCB1").getSelected();
            if(bSelected){
                var oTable = this.byId("idSmartTable_1").getTable();
            } else {
                oTable = this.byId("idSmartTable_2").getTable();
            }

            if (!oTable || !oTable.getColumns) {
                return;
            }

            oTable.getColumns().forEach(function (oColumn) {
                var aCustomData = oColumn.getCustomData();
                aCustomData.forEach(function (oCustomData) {
                    var oColumnKey = oCustomData.getValue();
                    if (oColumnKey && oColumnKey.columnKey === "BOMSubItemInstallationPoint_A") {
                        oColumn.setLabel(sValueA);
                    }

                    if (oColumnKey && oColumnKey.columnKey === "BOMSubItemInstallationPoint_B") {
                        oColumn.setLabel(sValueB);
                    }
                });
            });
        },
        
        onBeforeExport: function (oEvent) {
            var mExcelSettings = oEvent.getParameter("exportSettings");
            var sFileName = this.getModel("i18n").getResourceBundle().getText("appTitle");
            this._exportExcel(mExcelSettings, sFileName);
        },

        _exportExcel: function (mExcelSettings, sFileName) {
            mExcelSettings.fileName = sFileName + "_" + this.getCurrentDateTime();
        }
    });
});
