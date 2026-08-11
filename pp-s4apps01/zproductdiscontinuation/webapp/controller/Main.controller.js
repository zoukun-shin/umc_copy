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
 
        var SFB_ID = "SFBProductDiscontinuation";

        return Base.extend("pp.zproductdiscontinuation.controller.Main", {
            formatter: formatter,

            onInit: function () {
                this._LocalData = this.getOwnerComponent().getModel("local");
                this._oDataModel = this.getOwnerComponent().getModel();
                this._BusyDialog = new BusyDialog();
                this.getRouter().getRoute("Main").attachMatched(this._initialize, this);
            },

            _initialize: function () {
                this._UserInfo = sap.ushell.Container.getService("UserInfo");
                var sUser  = this._UserInfo.getFullName() === undefined ? "" : this._UserInfo.getFullName();
                var sEmail = this._UserInfo.getEmail()    === undefined ? "" : this._UserInfo.getEmail(); 
                var oContextBinding = this.getModel("Authority").bindContext(
                    "/User(Mail='" + sEmail + "',IsActiveEntity=true)", undefined, {
                        "$expand": "_AssignPlant,_AssignCompany,_AssignSalesOrg,_AssignPurchOrg,_AssignRole($expand=_UserRoleAccessBtn)"
                    });

                oContextBinding.requestObject().then(function (context) {
                    var aAccessBtns    = [],
                        aAllAccessBtns = [];
                    if (context._AssignRole && context._AssignRole.length > 0) {
                        context._AssignRole.forEach(function (role) {
                            aAccessBtns.push(role._UserRoleAccessBtn);
                        });
                        aAllAccessBtns = aAccessBtns.flat();
                    }
                    if (!aAllAccessBtns.some(function (btn) { return btn.AccessId === "zproductdiscontinuation-View"; })) {
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
                            View: aAllAccessBtns.some(function (btn) { return btn.AccessId === "zproductdiscontinuation-View"; })
                        },
                        data: {
                            PlantSet:    context._AssignPlant,
                            CompanySet:  context._AssignCompany,
                            SalesOrgSet: context._AssignSalesOrg,
                            PurchOrgSet: context._AssignPurchOrg,
                            RoleSet:     context._AssignRole
                        }
                    });
                }.bind(this), function () {
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

            // IncludeMrpArea 是 boolean 类型，SmartFilterBar 不自动处理，需手动加入 filter
            onBeforeRebindTable: function (oEvent) {
                var mBindingParams = oEvent.getParameter("bindingParams");

                // ===== 工厂权限校验：所选工厂必须都在用户权限工厂内 =====
                var oFilterData = this.byId(SFB_ID).getFilterData();
                var aSelectedPlants   = this._extractPlants(oFilterData.Plant);
                var aAuthorityPlantSet = this.getModel("local").getProperty("/authorityCheck/data/PlantSet") || [];

                var aNoAuthPlants = aSelectedPlants.filter(function (sPlant) {
                    return !aAuthorityPlantSet.some(function (data) { return data.Plant === sPlant; });
                });

                if (aNoAuthPlants.length > 0) {
                    MessageBox.error(
                        this.getView().getModel("i18n").getResourceBundle().getText(
                            "noAuthorityPlant", [aNoAuthPlants.join(", ")]
                        )
                    );
                    mBindingParams.preventTableBind = true;
                    return;
                }
                // ===== 工厂权限校验 END =====

                var bInclude = this.byId("cbIncludeMrpArea").getSelected();
                mBindingParams.filters.push(new Filter({
                    path: "IncludeMrpArea",
                    operator: FilterOperator.EQ,
                    value1: bInclude
                }));
            },

            // 从 SmartFilterBar 的工厂过滤值中取出所有已选工厂代码
            // 兼容：字符串单值 / 数组 / SmartFilterBar 区间对象({ items:[], ranges:[] })
            _extractPlants: function (vPlant) {
                var aResult = [];
                if (vPlant === undefined || vPlant === null || vPlant === "") {
                    return aResult;
                }
                if (typeof vPlant === "string") {
                    aResult.push(vPlant);
                } else if (Array.isArray(vPlant)) {
                    vPlant.forEach(function (v) {
                        if (v && typeof v === "object") {
                            if (v.key !== undefined) { aResult.push(v.key); }
                            else if (v.low !== undefined) { aResult.push(v.low); }
                        } else if (v) {
                            aResult.push(v);
                        }
                    });
                } else if (typeof vPlant === "object") {
                    (vPlant.items || []).forEach(function (o) {
                        if (o && o.key !== undefined) { aResult.push(o.key); }
                    });
                    (vPlant.ranges || []).forEach(function (o) {
                        if (o && o.low !== undefined) { aResult.push(o.low); }
                        if (o && o.high) { aResult.push(o.high); }
                    });
                    if (vPlant.value) { aResult.push(vPlant.value); }
                }
                // 去重、去空
                return aResult.filter(function (v, i, a) {
                    return v !== undefined && v !== null && v !== "" && a.indexOf(v) === i;
                });
            }
        });
    });