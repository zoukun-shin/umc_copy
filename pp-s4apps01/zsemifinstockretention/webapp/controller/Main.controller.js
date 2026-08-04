sap.ui.define([
    "./Base",
    "../model/formatter",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/BusyDialog",
    "sap/m/MessageBox",
],
    function (Base, formatter, Filter, FilterOperator, BusyDialog, MessageBox) {
        "use strict";

        return Base.extend("pp.zsemifinstockretention.controller.Main", {
            formatter: formatter,

            onInit: function () {
                this._LocalData = this.getOwnerComponent().getModel("local");
                this._oDataModel = this.getOwnerComponent().getModel();
                this._BusyDialog = new BusyDialog();
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
                    if (!aAllAccessBtns.some(btn => btn.AccessId === "zsemifinstockretention-View")) {
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
                            View: aAllAccessBtns.some(btn => btn.AccessId === "zsemifinstockretention-View")
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

            onDateRangeChange: function (oEvent) {
                var oSource = oEvent.getSource();
                var dStartDate = oSource.getDateValue();
                var dEndDate = oSource.getSecondDateValue();
                var oToday = new Date();
                oToday.setHours(0, 0, 0, 0);

                var bValidation = true;
                var sErrorMessage = "";

                // 验证开始日期和结束日期都不能早于今天
                if (dStartDate && dStartDate < oToday) {
                    bValidation = false;
                    sErrorMessage = this.getModel("i18n").getResourceBundle().getText("dateRangeStartError");
                }

                if (bValidation && dEndDate && dEndDate < oToday) {
                    bValidation = false;
                    sErrorMessage = this.getModel("i18n").getResourceBundle().getText("dateRangeEndError");
                }

                // 验证失败：显示错误并清空日期
                if (!bValidation) {
                    MessageBox.error(sErrorMessage, {
                        onClose: function () {
                            oSource.setDateValue(null);
                            oSource.setSecondDateValue(null);
                        }
                    });
                }
            },
            onBeforeRebindTable: function (oEvent) {
                var mBindingParams = oEvent.getParameter("bindingParams");

                // 工厂权限校验，不通过则不查询
                if (!this._checkPlantAuthority()) {
                    mBindingParams.preventTableBind = true;
                    return;
                }

                // customControl 的日期值不会自动进查询，手动取出并加入 filter
                var oDateRange = this.byId("dateRangeStartDate");
                var dLow = oDateRange.getDateValue();        // 起始日
                var dHigh = oDateRange.getSecondDateValue();  // 结束日

                if (dLow && dHigh) {
                    mBindingParams.filters.push(new Filter({
                        path: "MfgOrderPlannedStartDate",
                        operator: FilterOperator.BT,
                        value1: dLow,
                        value2: dHigh
                    }));
                } else if (dLow) {
                    mBindingParams.filters.push(new Filter({
                        path: "MfgOrderPlannedStartDate",
                        operator: FilterOperator.GE,
                        value1: dLow
                    }));
                }
            },

            // 校验检索条件里的工厂是否都在用户权限内
            // 返回 false 表示不通过，已弹出错误框
            _checkPlantAuthority: function () {
                var aAuthorityPlantSet = this.getModel("local").getProperty("/authorityCheck/data/PlantSet");
                if (!aAuthorityPlantSet) {
                    // 权限数据还没取回来，先不拦，_initialize 里失败会另行弹窗
                    return true;
                }

                var aPlants = this._getFilterPlants();
                if (aPlants.length === 0) {
                    return true;
                }

                var oBundle = this.getModel("i18n").getResourceBundle();
                for (var i = 0; i < aPlants.length; i++) {
                    var sPlant = aPlants[i];
                    var bHasAuthority = aAuthorityPlantSet.some(function (oAuth) {
                        return oAuth.Plant === sPlant;
                    });
                    if (!bHasAuthority) {
                        MessageBox.error(oBundle.getText("noAuthorityPlant", [sPlant]));
                        return false;
                    }
                }
                return true;
            },

            // 取检索条件里用户输入的所有工厂，值帮助选择项和手工区间都要取
            _getFilterPlants: function () {
                var oSFB = this.byId("SFBSemiFinStockRetention");
                if (!oSFB) {
                    return [];
                }

                var oPlantData = (oSFB.getFilterData() || {}).Plant;
                if (!oPlantData) {
                    return [];
                }
                if (typeof oPlantData === "string") {
                    return [oPlantData];
                }

                var aPlants = [];
                (oPlantData.items || []).forEach(function (oItem) {
                    if (oItem.key) {
                        aPlants.push(oItem.key);
                    }
                });
                (oPlantData.ranges || []).forEach(function (oRange) {
                    if (oRange.value1) {
                        aPlants.push(oRange.value1);
                    }
                    if (oRange.value2) {
                        aPlants.push(oRange.value2);
                    }
                });
                if (oPlantData.value) {
                    aPlants.push(oPlantData.value);
                }

                return aPlants.filter(function (sPlant, iIndex) {
                    return aPlants.indexOf(sPlant) === iIndex;
                });
            }
        });
    });